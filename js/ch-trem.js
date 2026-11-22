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

  const lfoC = SD.canvas({ label: 'The LFO', hint: 'a slow wave that turns the knob for you', height: 140 });
  const sig = SD.canvas({ label: 'What it does to your signal', hint: 'three wobbles', height: 230 });

  const WIN = 2;
  const lfoAt = (t) => fx.lfo.value(t);
  lfoC.draw = () => {
    const { g, w, h: H } = lfoC;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const fr = { L: 44, R: 44, T: 8, B: 30 };
    const now = ctx.currentTime, mid = fr.T + (H - fr.T - fr.B) / 2, A = (H - fr.T - fr.B) / 2 - 2, pw = w - fr.L - fr.R;
    g.lineWidth = 1; g.font = '10px "DM Mono", monospace';
    [-1, 0, 1].forEach((v) => {
      g.strokeStyle = v ? SD.COL.grid : SD.COL.grid2; g.beginPath(); g.moveTo(fr.L, mid - v * A); g.lineTo(fr.L + pw, mid - v * A); g.stroke();
      g.fillStyle = SD.COL.ink3; g.textAlign = 'right'; g.fillText(v > 0 ? '+1' : String(v), fr.L - 5, mid - v * A + 3.5);
    });
    g.textAlign = 'center';
    [[0, '−2 s'], [0.5, '−1 s'], [1, 'now']].forEach(([f, t]) => { g.textAlign = f === 1 ? 'right' : f ? 'center' : 'left'; g.fillText(t, fr.L + f * pw, H - fr.B + 13); });
    SD.axisTitles(lfoC, fr, 'time', 'LFO');
    const pts = [];
    for (let i = 0; i <= 300; i++) { const t = now - WIN + (i / 300) * WIN; pts.push([fr.L + (i / 300) * pw, mid - lfoAt(t) * A * (pedal.on ? 1 : 0)]); }
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
    const fr = { L: 44, R: 8, T: 22, B: 30 };
    const now = ctx.currentTime, mid = fr.T + (H - fr.T - fr.B) / 2, A = (H - fr.T - fr.B) / 2 - 2, pw = w - fr.L - fr.R;
    const p = fx.params, n = Math.floor(pw * 2), pts = [], env = [];
    g.lineWidth = 1; g.font = '10px "DM Mono", monospace';
    [-1, 0, 1].forEach((v) => {
      g.strokeStyle = v ? SD.COL.grid : SD.COL.grid2; g.beginPath(); g.moveTo(fr.L, mid - v * A); g.lineTo(w - fr.R, mid - v * A); g.stroke();
      g.fillStyle = SD.COL.ink3; g.textAlign = 'right'; g.fillText(v > 0 ? '+1' : String(v), fr.L - 5, mid - v * A + 3.5);
    });
    const winS = 3 / p.rate;
    g.textAlign = 'center';
    [0, 1, 2, 3].forEach((c) => (g.textAlign = c === 3 ? 'right' : c === 0 ? 'left' : 'center') && g.fillText((c ? '+' : '') + (c / p.rate).toFixed(2).replace(/\.?0+$/, '') + ' s', fr.L + (c / 3) * pw, H - fr.B + 13));
    SD.axisTitles(sig, fr, `time (3 LFO cycles = ${winS.toFixed(2)} s; wiggles drawn slower than real)`, 'amplitude');
    const on = pedal.on, win = 3 / p.rate, CYC = 9; // 9 visual wiggles per LFO wobble
    const k = p.depth * 0.6 * CYC; // phase deviation → ±(0.6·depth) relative pitch swing, exaggerated for the eye
    for (let i = 0; i <= n; i++) {
      const t = now - win + (i / n) * win, ph = fx.lfo.phase(t);
      let amp = 1, phase = 2 * Math.PI * CYC * ph;
      if (on && p.mode === 'tremolo') amp = 1 - p.depth / 2 + (p.depth / 2) * lfoAt(t);
      if (on && p.mode === 'vibrato') phase += -k * Math.cos(2 * Math.PI * ph);
      const x = fr.L + (i / n) * pw;
      pts.push([x, mid - Math.sin(phase) * amp * A]);
      if (i % 4 === 0) env.push([x, mid - amp * A]);
    }
    if (on && p.mode === 'tremolo') {
      g.beginPath(); env.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      for (let i = env.length - 1; i >= 0; i--) g.lineTo(env[i][0], 2 * mid - env[i][1]);
      g.closePath(); g.fillStyle = SD.alpha(accent, 0.18); g.fill();
    }
    SD.strokePath(g, pts, on ? SD.alpha('#2b2320', 0.85) : SD.COL.ink3, 1.4);
    g.font = '11px "DM Mono", monospace'; g.fillStyle = SD.COL.ink2; g.textAlign = 'left';
    g.fillText(!on ? 'bypassed: steady wave' : p.mode === 'tremolo' ? 'height swells and shrinks → volume' : 'wiggles squeeze and stretch → pitch', fr.L + 4, 14);
  };
  SD.onFrame(() => { lfoC.draw(); sig.draw(); }, document.getElementById('bench-trem'));

  SD.bench('trem', { label: 'Wobble Lamp tremolo', sources: ['held', 'arp', 'note', 'sine'], source: 'held', dest: () => fx.inputNode, pedal, graphs: [lfoC, sig] });
})();
