/* Chapter 3: compressor. */
(function () {
  const { h } = SD;
  const accent = SD.accentOf('comp');
  const fx = SD.fx.comp();
  fx.outputNode.connect(SD.master);

  const db = (v) => (v > 0 ? '+' : '') + Math.round(v) + ' dB';
  const ms = (v) => (v < 0.01 ? (v * 1000).toFixed(1) : Math.round(v * 1000)) + ' ms';
  const kThr = SD.knob({ label: 'Threshold', tip: 'The volume line. Anything louder gets squashed.', min: -60, max: 0, value: -28, format: db, onInput: (v) => { fx.set('threshold', v); curve.draw(); } });
  const kRatio = SD.knob({ label: 'Ratio', tip: 'How hard it squashes. At 4:1, going 4 dB over the line comes out only 1 dB over.', min: 1, max: 20, value: 4, scale: 'log', format: (v) => (v >= 19.5 ? '20:1 (limit)' : v.toFixed(v < 3 ? 1 : 0) + ':1'), onInput: (v) => { fx.set('ratio', v); curve.draw(); } });
  const kAtk = SD.knob({ label: 'Attack', tip: 'How fast it grabs. Slow lets the pick “snap” through first.', min: 0.001, max: 0.2, value: 0.008, scale: 'log', format: ms, onInput: (v) => fx.set('attack', v) });
  const kRel = SD.knob({ label: 'Release', tip: 'How fast it lets go once the note gets quieter.', min: 0.03, max: 1, value: 0.22, scale: 'log', format: ms, onInput: (v) => fx.set('release', v) });
  const kOut = SD.knob({ label: 'Output', tip: 'Make‑up volume to win back what the squashing took.', min: -12, max: 12, value: 0, format: db, onInput: (v) => fx.set('makeup', v) });

  const leds = Array.from({ length: 12 }, () => h('i'));
  const grText = h('span', null, '0 dB');
  const meter = h('div', { class: 'gr-meter', 'aria-hidden': 'true' },
    h('div', { class: 'gr-label' }, h('span', null, 'GAIN REDUCTION'), grText), h('div', { class: 'gr-leds' }, leds));

  const pedal = SD.pedal({ name: 'Squeezebox', sub: 'compressor', fx, knobs: [kThr, kRatio, kAtk, kRel, kOut], middle: meter });

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
    const s = Math.min(w - 40, H - 30), ox = (w - s) / 2 + 10, oy = 6;
    const X = (v) => ox + ((v - LO) / -LO) * s, Y = (v) => oy + (1 - (v - LO) / -LO) * s;
    g.strokeStyle = SD.COL.grid; g.lineWidth = 1;
    g.font = '10px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3;
    for (let v = LO; v <= 0; v += 12) {
      g.beginPath(); g.moveTo(X(v), Y(LO)); g.lineTo(X(v), Y(0)); g.stroke();
      g.beginPath(); g.moveTo(X(LO), Y(v)); g.lineTo(X(0), Y(v)); g.stroke();
      g.textAlign = 'right'; g.fillText(v, ox - 4, Y(v) + 3);
      g.textAlign = 'center'; g.fillText(v, X(v), oy + s + 13);
    }
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
    const Y = (v) => 8 + (1 - (SD.clamp(v, LO, 0) - LO) / -LO) * (H - 16);
    g.strokeStyle = SD.COL.grid; g.lineWidth = 1; g.font = '10px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3; g.textAlign = 'left';
    for (let v = LO; v <= 0; v += 12) { g.beginPath(); g.moveTo(0, Y(v)); g.lineTo(w, Y(v)); g.stroke(); g.fillText(v + ' dB', 4, Y(v) + (v === 0 ? 11 : -3)); }
    if (pedal.on) { g.setLineDash([4, 4]); g.strokeStyle = SD.alpha(accent, 0.7); g.beginPath(); g.moveTo(0, Y(fx.params.threshold)); g.lineTo(w, Y(fx.params.threshold)); g.stroke(); g.setLineDash([]); }
    const line = (arr, color, width, fill) => {
      const pts = [];
      for (let i = 0; i < N; i++) pts.push([(i / (N - 1)) * w, Y(arr[(head + i) % N])]);
      if (fill) {
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.lineTo(w, H); g.lineTo(0, H); g.closePath(); g.fillStyle = fill; g.fill();
      }
      SD.strokePath(g, pts, color, width);
    };
    line(hin, 'rgba(43,35,32,.32)', 1.6, 'rgba(43,35,32,.05)');
    line(hout, accent, 2.4, SD.alpha(accent, 0.12));
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

  const bench = SD.bench('comp', { label: 'Squeezebox compressor', sources: ['dynamic', 'note', 'funk', 'pulses', 'drums'], source: 'dynamic', dest: () => fx.inputNode, pedal, graphs: [curve, hist], graphLayout: 'two' });
})();
