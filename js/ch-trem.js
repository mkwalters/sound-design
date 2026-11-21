/* Chapter 5: tremolo & vibrato — the LFO. */
(function () {
  const { h, ctx } = SD;
  const accent = SD.accentOf('trem');
  const fx = SD.fx.trem();
  fx.outputNode.connect(SD.master);

  const mode = SD.segmented({ label: 'Mode', options: [{ value: 'tremolo', label: 'Tremolo · volume', tip: 'The LFO turns the volume knob.' }, { value: 'vibrato', label: 'Vibrato · pitch', tip: 'The LFO bends the pitch up and down.' }],
    value: 'tremolo', onChange: (v) => fx.set('mode', v) });
  const shape = SD.segmented({ small: true, label: 'LFO shape', options: [{ value: 'sine', label: '∿ sine', tip: 'Smooth, gentle swell.' }, { value: 'triangle', label: '⋀ tri', tip: 'Even, steady ramps.' }, { value: 'square', label: '⊓ square', tip: 'On/off chop: a stutter.' }],
    value: 'sine', onChange: (v) => fx.set('shape', v) });
  const kRate = SD.knob({ label: 'Rate', tip: 'Speed of the wobble, in wobbles per second.', min: 0.5, max: 12, value: 5, scale: 'log', format: (v) => v.toFixed(1) + ' Hz', onInput: (v) => fx.set('rate', v) });
  const kDepth = SD.knob({ label: 'Depth', tip: 'How far it wobbles. 100% = full on/off chop.', min: 0, max: 1, value: 0.7, format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('depth', v) });

  const pedal = SD.pedal({ name: 'Wobble Lamp', sub: 'tremolo · vibrato', fx, top: mode.el, knobs: [kRate, kDepth],
    middle: h('div', { class: 'ctl-group' }, h('span', { class: 'ctl-label' }, 'lfo shape'), shape.el) });

  const lfoC = SD.canvas({ label: 'The LFO', hint: 'a slow wave that turns the knob for you', height: 110 });
  const sig = SD.canvas({ label: 'What it does to your signal', hint: 'three wobbles, slowed down', height: 200 });

  const WIN = 2;
  const lfoAt = (t) => fx.lfo.value(t);
  lfoC.draw = () => {
    const { g, w, h: H } = lfoC;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const now = ctx.currentTime, mid = H / 2, A = H / 2 - 12;
    g.strokeStyle = SD.COL.grid2; g.lineWidth = 1; g.beginPath(); g.moveTo(0, mid); g.lineTo(w, mid); g.stroke();
    const pts = [];
    for (let i = 0; i <= 300; i++) { const t = now - WIN + (i / 300) * WIN; pts.push([(i / 300) * (w - 40), mid - lfoAt(t) * A * (pedal.on ? 1 : 0)]); }
    SD.strokePath(g, pts, accent, 3);
    // the "hand" turning the knob at the right edge
    const v = pedal.on ? lfoAt(now) : 0;
    const kx = w - 20, ky = mid;
    g.beginPath(); g.arc(kx, ky, 14, 0, Math.PI * 2); g.fillStyle = '#efe4cc'; g.fill(); g.lineWidth = 2; g.strokeStyle = SD.COL.ink; g.stroke();
    const ang = -Math.PI / 2 + v * fx.params.depth * 2.2;
    g.beginPath(); g.moveTo(kx, ky); g.lineTo(kx + Math.cos(ang) * 11, ky + Math.sin(ang) * 11); g.lineWidth = 3; g.stroke();
    g.beginPath(); g.arc(pts[pts.length - 1][0], pts[pts.length - 1][1], 5, 0, Math.PI * 2); g.fillStyle = accent; g.fill();
  };
  sig.draw = () => {
    const { g, w, h: H } = sig;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const now = ctx.currentTime, mid = H / 2, A = H / 2 - 14;
    const p = fx.params, n = Math.floor(w * 2), pts = [], env = [];
    const on = pedal.on, win = 3 / p.rate, CYC = 9; // 9 visual wiggles per LFO wobble
    const k = p.depth * 0.6 * CYC; // phase deviation → ±(0.6·depth) relative pitch swing, exaggerated for the eye
    for (let i = 0; i <= n; i++) {
      const t = now - win + (i / n) * win, ph = fx.lfo.phase(t);
      let amp = 1, phase = 2 * Math.PI * CYC * ph;
      if (on && p.mode === 'tremolo') amp = 1 - p.depth / 2 + (p.depth / 2) * lfoAt(t);
      if (on && p.mode === 'vibrato') phase += -k * Math.cos(2 * Math.PI * ph);
      const x = (i / n) * w;
      pts.push([x, mid - Math.sin(phase) * amp * A]);
      if (i % 4 === 0) env.push([x, mid - amp * A]);
    }
    if (on && p.mode === 'tremolo') {
      g.beginPath(); env.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      for (let i = env.length - 1; i >= 0; i--) g.lineTo(env[i][0], 2 * mid - env[i][1]);
      g.closePath(); g.fillStyle = SD.alpha(accent, 0.18); g.fill();
    }
    SD.strokePath(g, pts, on ? SD.alpha('#2b2320', 0.85) : SD.COL.ink3, 1.4);
    g.font = '11px "DM Mono", monospace'; g.fillStyle = SD.COL.ink2;
    g.fillText(!on ? 'bypassed: steady wave' : p.mode === 'tremolo' ? 'height swells and shrinks → volume' : 'wiggles squeeze and stretch → pitch', 6, 14);
  };
  SD.onFrame(() => { lfoC.draw(); sig.draw(); }, document.getElementById('bench-trem'));

  SD.bench('trem', { label: 'Wobble Lamp tremolo', sources: ['sine', 'saw', 'chords', 'lick'], source: 'sine', dest: () => fx.inputNode, pedal, graphs: [lfoC, sig] });
})();
