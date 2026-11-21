/* Chapter 9: reverb. */
(function () {
  const { h } = SD;
  const accent = SD.accentOf('reverb');
  const fx = SD.fx.reverb();
  fx.outputNode.connect(SD.master);

  const TYPES = {
    room: { decay: 0.8, damping: 0.45, predelay: 0.005, mix: 0.35 },
    hall: { decay: 2.6, damping: 0.4, predelay: 0.02, mix: 0.35 },
    plate: { decay: 1.8, damping: 0.1, predelay: 0.0, mix: 0.35 },
    spring: { decay: 2.2, damping: 0.5, predelay: 0.0, mix: 0.42 },
  };
  const kDecay = SD.knob({ label: 'Decay', tip: 'How long the room rings.', min: 0.3, max: 8, value: 2.6, scale: 'log', format: (v) => v.toFixed(1) + ' s', onInput: (v) => fx.set('decay', v) });
  const kPre = SD.knob({ label: 'Pre‑delay', tip: 'Pause before the room answers. Keeps notes clear.', min: 0, max: 0.2, value: 0.02, format: (v) => Math.round(v * 1000) + ' ms', onInput: (v) => { fx.set('predelay', v); irC.draw(); } });
  const kDamp = SD.knob({ label: 'Damping', tip: 'Soft walls soak up the treble. More = darker.', min: 0, max: 1, value: 0.4, format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('damping', v) });
  const kMix = SD.knob({ label: 'Mix', tip: 'Dry you vs. the room.', min: 0, max: 1, value: 0.35, format: (v) => Math.round(v * 100) + '%', onInput: (v) => { fx.set('mix', v); irC.draw(); } });
  const knobs = { decay: kDecay, predelay: kPre, damping: kDamp, mix: kMix };
  const type = SD.segmented({ label: 'Reverb type', options: [{ value: 'room', label: 'Room', tip: 'Small, natural space.' }, { value: 'hall', label: 'Hall', tip: 'Big, lush concert hall.' }, { value: 'plate', label: 'Plate', tip: 'A vibrating steel sheet: bright and smooth.' }, { value: 'spring', label: 'Spring', tip: 'A shaken metal spring: drippy surf boing.' }],
    value: 'hall', onChange: (v) => { fx.set('type', v); Object.entries(TYPES[v]).forEach(([k, val]) => knobs[k].set(val)); } });

  const pedal = SD.pedal({ name: 'Big Room', sub: 'reverb', fx, top: type.el, knobs: Object.values(knobs), onToggle: () => irC.draw() });
  const irC = SD.canvas({ label: 'Impulse response', hint: 'one clap in → this comes out', height: 270 });
  fx.onIR = () => irC.draw();

  irC.draw = () => {
    const { g, w, h: H } = irC;
    if (!w || !fx.ir) return;
    g.clearRect(0, 0, w, H);
    const p = fx.params, data = fx.ir.getChannelData(0), sr = fx.ir.sampleRate;
    const L = 30, R = 10, B = 22, T = 26;
    const span = Math.max(1, Math.min(9, p.decay * 1.1 + p.predelay + 0.1));
    const X = (t) => L + (t / span) * (w - L - R);
    const Y = (a) => H - B - a * (H - B - T);
    g.font = '10.5px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3; g.textAlign = 'center'; g.strokeStyle = SD.COL.grid; g.lineWidth = 1;
    const step = span > 4 ? 1 : span > 2 ? 0.5 : 0.25;
    for (let t = 0; t <= span + 1e-6; t += step) { g.beginPath(); g.moveTo(X(t), T); g.lineTo(X(t), H - B); g.stroke(); g.fillText(+t.toFixed(2) + 's', X(t), H - 6); }
    // direct sound
    const dryA = pedal.on ? 1 - p.mix * 0.6 : 1;
    g.fillStyle = SD.COL.ink; g.fillRect(X(0) - 3, Y(dryA), 6, H - B - Y(dryA));
    if (!pedal.on) { g.fillStyle = SD.COL.ink2; g.textAlign = 'left'; g.fillText('bypassed: only the direct sound', X(0) + 10, T + 6); return; }
    // envelope of the IR (max abs per pixel column), scaled for display
    const cols = Math.floor(w - L - R), env = new Float32Array(cols);
    let peak = 0;
    for (let c = 0; c < cols; c++) {
      const t0 = (c / cols) * span - p.predelay, t1 = ((c + 1) / cols) * span - p.predelay;
      if (t1 <= 0) continue;
      const i0 = Math.max(0, Math.floor(t0 * sr)), i1 = Math.min(data.length, Math.floor(t1 * sr));
      let m = 0; for (let i = i0; i < i1; i++) { const v = Math.abs(data[i]); if (v > m) m = v; }
      env[c] = m; if (m > peak) peak = m;
    }
    const scale = (p.mix * 1.1) / (peak || 1);
    g.beginPath(); g.moveTo(L, H - B);
    for (let c = 0; c < cols; c++) g.lineTo(L + c, Y(Math.min(1, Math.sqrt(env[c] * scale) * 0.95)));
    g.lineTo(L + cols, H - B); g.closePath();
    const grd = g.createLinearGradient(0, T, 0, H - B); grd.addColorStop(0, SD.alpha(accent, 0.85)); grd.addColorStop(1, SD.alpha(accent, 0.25));
    g.fillStyle = grd; g.fill();
    // labels
    g.fillStyle = SD.COL.ink2; g.textAlign = 'left';
    g.fillText('direct', X(0) + 6, Y(dryA) + 4);
    if (p.predelay > 0.015) { g.fillText('pre‑delay', X(0) + 6, H - B - 8); }
    if (p.type === 'room' || p.type === 'hall') g.fillText('early reflections', X(p.predelay + 0.01) + 4, T - 8);
    const tailT = p.predelay + p.decay * 0.35;
    if (X(tailT) < w - 80) g.fillText('tail', X(tailT), Y(0.25) - 4);
    const rt = p.predelay + p.decay;
    if (rt < span) {
      g.setLineDash([4, 4]); g.strokeStyle = SD.alpha('#2b2320', 0.45);
      g.beginPath(); g.moveTo(X(rt), T); g.lineTo(X(rt), H - B); g.stroke(); g.setLineDash([]);
      g.textAlign = 'right'; g.fillText('−60 dB', X(rt) - 4, T + 10);
    }
  };

  SD.bench('reverb', { label: 'Big Room reverb', sources: ['blip', 'pluck', 'lick', 'drums'], source: 'blip', dest: () => fx.inputNode, pedal, graphs: [irC] });
})();
