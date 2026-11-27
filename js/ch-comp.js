/* Chapter 3: compressor. */
(function () {
  const { h } = SD;
  const accent = SD.accentOf('comp');
  const fx = SD.fx.comp();
  fx.outputNode.connect(SD.master);

  const db = (v) => (v > 0 ? '+' : '') + Math.round(v) + ' dB';
  const ms = (v) => (v < 0.01 ? (v * 1000).toFixed(1) : Math.round(v * 1000)) + ' ms';
  const kThr = SD.knob({ label: 'Threshold', tip: 'The volume line. Anything louder gets squashed.', min: -60, max: 0, value: -40, part: 'detect', format: db, onInput: (v) => { fx.set('threshold', v); curve.draw(); } });
  const kRatio = SD.knob({ label: 'Ratio', tip: 'How hard it squashes. At 4:1, going 4 dB over the line comes out only 1 dB over.', min: 1, max: 20, value: 10, scale: 'log', part: 'detect', format: (v) => (v >= 19.5 ? '20:1 (limit)' : v.toFixed(v < 3 ? 1 : 0) + ':1'), onInput: (v) => { fx.set('ratio', v); curve.draw(); } });
  const kAtk = SD.knob({ label: 'Attack', tip: 'How fast it grabs. Slow lets the pick “snap” through first.', min: 0.001, max: 0.2, value: 0.003, scale: 'log', part: 'vca', format: ms, onInput: (v) => fx.set('attack', v) });
  const kRel = SD.knob({ label: 'Release', tip: 'How fast it lets go once the note gets quieter.', min: 0.03, max: 1, value: 0.25, scale: 'log', part: 'vca', format: ms, onInput: (v) => fx.set('release', v) });
  const kOut = SD.knob({ label: 'Output', tip: 'Make‑up volume to win back what the squashing took.', min: -12, max: 12, value: 7, part: 'makeup', format: db, onInput: (v) => fx.set('makeup', v) });

  const leds = Array.from({ length: 12 }, () => h('i'));
  const grText = h('span', null, '0 dB');
  const meter = h('div', { class: 'gr-meter', 'aria-hidden': 'true' },
    h('div', { class: 'gr-label' }, h('span', null, 'GAIN REDUCTION'), grText), h('div', { class: 'gr-leds' }, leds));

  const pedal = SD.pedal({ name: 'Squeezebox', sub: 'compressor', fx, knobs: [kThr, kRatio, kAtk, kRel, kOut], middle: meter });

  const PRESETS = {
    gentle: { thr: -26, ratio: 3, atk: 0.012, rel: 0.2, out: 3 },
    squish: { thr: -42, ratio: 8, atk: 0.002, rel: 0.15, out: 9 },
    snap: { thr: -40, ratio: 10, atk: 0.07, rel: 0.2, out: 2 },
    limit: { thr: -28, ratio: 20, atk: 0.001, rel: 0.1, out: 6 },
  };
  const presets = SD.presetBar({ options: [
    { value: 'gentle', label: 'Gentle', tip: 'Light smoothing you feel more than hear.' },
    { value: 'squish', label: 'Squish', tip: 'Heavy, fast squeeze: the country and funk “pop”, with long sustain.' },
    { value: 'snap', label: 'Slow attack', tip: 'The pick snaps through before the squeeze lands.' },
    { value: 'limit', label: 'Limiter', tip: 'A hard ceiling: nothing gets past the threshold.' },
  ], apply: (v) => { const s = PRESETS[v]; kThr.set(s.thr); kRatio.set(s.ratio); kAtk.set(s.atk); kRel.set(s.rel); kOut.set(s.out); } });

  const flow = SD.flow({ height: 104, on: () => pedal.on, draw(d) {
    const y = 26, y2 = 76;
    d.io(12, y, 'in'); d.io(288, y, 'out'); d.dot(38, y);
    d.wire([[16, y], [102, y]]); d.box(138, y, 68, 'volume', { part: 'vca' });
    d.wire([[172, y], [190, y]]); d.box(222, y, 60, 'make‑up', { part: 'makeup' });
    d.wire([[252, y], [283, y]]);
    d.wire([[38, y], [38, y2], [52, y2]], { ctl: true }); d.box(88, y2, 68, 'listener', { part: 'detect', ctl: true, sub: `over ${Math.round(fx.params.threshold)} dB?` });
    d.wire([[122, y2], [138, y2], [138, y + 13]], { ctl: true });
    d.note(146, 58, 'turns it down', { anchor: 'start', ctl: true });
  } });

  const curve = SD.canvas({ label: 'Transfer curve', hint: 'in dB', height: 220 });
  const hist = SD.canvas({ label: 'Level over time', hint: 'grey = in · color = out', height: 220 });
  meter.dataset.tip = 'How many decibels the compressor is turning down right now.'; meter.dataset.tipTitle = 'Gain reduction'; meter.removeAttribute('aria-hidden');

  const LO = -60;
  const staticOut = (x) => {
    const T = fx.params.threshold, R = fx.params.ratio, K = 4;
    if (!pedal.on) return x;
    if (x < T - K / 2) return x;
    if (x > T + K / 2) return T + (x - T) / R;
    const d = x - T + K / 2; return x + ((1 / R - 1) * d * d) / (2 * K);
  };
  let inDb = -100, outDb = -100, grDb = 0;
  curve.draw = () => {
    const { g, w, h: H } = curve;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const s = Math.min(w - 64, H - 40), ox = (w - s) / 2 + 16, oy = 6;
    const X = (v) => ox + ((v - LO) / -LO) * s, Y = (v) => oy + (1 - (v - LO) / -LO) * s;
    g.strokeStyle = SD.COL.grid; g.lineWidth = 1;
    g.font = '10px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3;
    for (let v = LO; v <= 0; v += 12) {
      g.beginPath(); g.moveTo(X(v), Y(LO)); g.lineTo(X(v), Y(0)); g.stroke();
      g.beginPath(); g.moveTo(X(LO), Y(v)); g.lineTo(X(0), Y(v)); g.stroke();
      g.textAlign = 'right'; g.fillText(v, ox - 4, Y(v) + 3);
      g.textAlign = 'center'; g.fillText(v, X(v), oy + s + 13);
    }
    g.fillStyle = SD.COL.ink2; g.textAlign = 'center';
    g.fillText('input level (dB)', X(LO / 2), oy + s + 27);
    g.save(); g.translate(ox - 30, Y(LO / 2)); g.rotate(-Math.PI / 2); g.fillText('output level (dB)', 0, 0); g.restore();
    g.fillStyle = SD.COL.ink3;
    g.setLineDash([5, 5]); SD.strokePath(g, [[X(LO), Y(LO)], [X(0), Y(0)]], SD.COL.ink3, 1.3); g.setLineDash([]);
    const T = fx.params.threshold;
    if (pedal.on) {
      g.fillStyle = SD.alpha(accent, 0.08); g.fillRect(X(T), Y(0), X(0) - X(T), s);
      g.fillStyle = accent; g.textAlign = 'left';
      g.fillText('threshold', Math.min(X(T) + 4, X(0) - 58), Y(LO) - 6);
      g.strokeStyle = SD.alpha(accent, 0.5); g.beginPath(); g.moveTo(X(T), Y(LO)); g.lineTo(X(T), Y(0)); g.stroke();
    }
    const pts = [];
    for (let v = LO; v <= 0; v += 0.5) pts.push([X(v), Y(staticOut(v))]);
    SD.strokePath(g, pts, accent, 3.2);
    if (inDb > LO) {
      const x = SD.clamp(inDb, LO, 0);
      g.beginPath(); g.arc(X(x), Y(staticOut(x)), 7, 0, Math.PI * 2);
      g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = SD.COL.ink; g.stroke();
    }
  };

  const N = 260, hin = new Float32Array(N).fill(-100), hout = new Float32Array(N).fill(-100);
  let head = 0;
  hist.draw = () => {
    const { g, w, h: H } = hist;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const fr = { L: 44, R: 6, T: 8, B: 30 };
    const Y = (v) => fr.T + (1 - (SD.clamp(v, LO, 0) - LO) / -LO) * (H - fr.T - fr.B);
    const XS = (i) => fr.L + (i / (N - 1)) * (w - fr.L - fr.R);
    g.strokeStyle = SD.COL.grid; g.lineWidth = 1; g.font = '10px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3; g.textAlign = 'right';
    for (let v = LO; v <= 0; v += 12) { g.beginPath(); g.moveTo(fr.L, Y(v)); g.lineTo(w - fr.R, Y(v)); g.stroke(); g.fillText(String(v), fr.L - 5, Y(v) + 3.5); }
    g.textAlign = 'center';
    [[0, '−4 s', 'left'], [N / 2, '−2 s', 'center'], [N - 1, 'now', 'right']].forEach(([i, t, al]) => { g.textAlign = al; g.fillText(t, XS(i), H - fr.B + 13); });
    SD.axisTitles(hist, fr, 'time', 'level (dB)');
    if (pedal.on) { g.setLineDash([4, 4]); g.strokeStyle = SD.alpha(accent, 0.7); g.beginPath(); g.moveTo(fr.L, Y(fx.params.threshold)); g.lineTo(w - fr.R, Y(fx.params.threshold)); g.stroke(); g.setLineDash([]); }
    const line = (arr, color, width, fill) => {
      const pts = [];
      for (let i = 0; i < N; i++) pts.push([XS(i), Y(arr[(head + i) % N])]);
      if (fill) {
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.lineTo(XS(N - 1), Y(LO)); g.lineTo(XS(0), Y(LO)); g.closePath(); g.fillStyle = fill; g.fill();
      }
      SD.strokePath(g, pts, color, width);
    };
    line(hin, 'rgba(43,35,32,.32)', 1.6, 'rgba(43,35,32,.05)');
    line(hout, accent, 2.4, SD.alpha(accent, 0.12));
    // loud‑to‑quiet spread over the window: the number a compressor shrinks
    const sIn = spread(hin), sOut = spread(hout);
    if (sIn != null) {
      g.textAlign = 'left'; g.font = '11px "DM Mono", monospace';
      g.fillStyle = 'rgba(253,250,243,.9)'; g.fillRect(fr.L + 4, fr.T + 2, 236, 18);
      g.fillStyle = SD.COL.ink2; g.fillText(`loud↔quiet: in ${sIn} dB → `, fr.L + 8, fr.T + 15);
      g.fillStyle = accent; g.fillText(`out ${sOut} dB`, fr.L + 8 + g.measureText(`loud↔quiet: in ${sIn} dB → `).width, fr.T + 15);
    }
  };
  const spread = (arr) => {
    const v = Array.from(arr).filter((x) => x > -70).sort((a, b) => a - b);
    if (v.length < N * 0.5) return null;
    return Math.round(v[Math.floor(0.95 * (v.length - 1))] - v[Math.floor(0.1 * (v.length - 1))]);
  };

  const buf = new Float32Array(fx.preA.fftSize);
  const peakDb = (an) => {
    an.getFloatTimeDomainData(buf);
    let p = 0; for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i]));
    return SD.gainToDb(p);
  };
  SD.onFrame(() => {
    const playing = SD.player.current && SD.player.current.owner === bench.transport.owner;
    const iD = playing ? peakDb(fx.preA) : -100;
    const oD = playing ? (pedal.on ? peakDb(fx.postA) : iD) : -100;
    inDb = iD > inDb ? iD : inDb - 1.2;
    outDb = oD;
    grDb = pedal.on && playing ? fx.comp.reduction : 0;
    hin[head] = iD; hout[head] = oD; head = (head + 1) % N;
    const lit = Math.round(SD.clamp(-grDb / 2, 0, 12));
    leds.forEach((l, i) => { l.classList.toggle('lit', i < lit); l.classList.toggle('hot', i >= 8 && i < lit); });
    grText.textContent = (grDb < -0.05 ? grDb.toFixed(1) : '0') + ' dB';
    curve.draw(); hist.draw();
  }, document.getElementById('bench-comp'));

  const bench = SD.bench('comp', { label: 'Squeezebox compressor', sources: ['dynamic', 'note', 'funk', 'pulses', 'drums'], source: 'dynamic', dest: () => fx.inputNode, pedal, flow, flowIn: 'graphs', presets, graphs: [curve, hist], graphLayout: 'two' });
})();
