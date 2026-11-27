/* Chapter 5: tremolo & vibrato — the LFO. */
(function () {
  const { h, ctx } = SD;
  const accent = SD.accentOf('trem');
  const fx = SD.fx.trem();
  fx.outputNode.connect(SD.master);

  const mode = SD.segmented({ label: 'Mode', options: [{ value: 'tremolo', label: 'Tremolo · volume', tip: 'The LFO turns the volume knob.' }, { value: 'vibrato', label: 'Vibrato · pitch', tip: 'The LFO bends the pitch up and down.' }],
    value: 'tremolo', part: 'target', onChange: (v) => fx.set('mode', v) });
  const shape = SD.segmented({ small: true, label: 'LFO shape', options: [{ value: 'sine', label: '∿ sine', tip: 'Smooth, gentle swell.' }, { value: 'triangle', label: '⋀ tri', tip: 'Even, steady ramps.' }, { value: 'square', label: '⊓ square', tip: 'On/off chop: a stutter.' }],
    value: 'sine', part: 'lfo', onChange: (v) => fx.set('shape', v) });
  const kRate = SD.knob({ label: 'Rate', tip: 'Speed of the wobble, in wobbles per second.', min: 0.5, max: 12, value: 5, scale: 'log', part: 'lfo', format: (v) => v.toFixed(1) + ' Hz', onInput: (v) => fx.set('rate', v) });
  const kDepth = SD.knob({ label: 'Depth', tip: 'How far it wobbles. 100% = full on/off chop.', min: 0, max: 1, value: 0.7, part: 'amount', format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('depth', v) });

  const PRESETS = {
    surf: { mode: 'tremolo', rate: 6.5, depth: 0.6, shape: 'sine' },
    throb: { mode: 'tremolo', rate: 2.2, depth: 0.85, shape: 'triangle' },
    chop: { mode: 'tremolo', rate: 9, depth: 1, shape: 'square' },
    seasick: { mode: 'vibrato', rate: 4.5, depth: 0.65, shape: 'sine' },
  };
  const presets = SD.presetBar({ options: [
    { value: 'surf', label: 'Surf', tip: 'The quick, smooth shimmer of a 60s amp.' },
    { value: 'throb', label: 'Slow throb', tip: 'Deep, lazy swells.' },
    { value: 'chop', label: 'Helicopter', tip: 'Square LFO at full depth: the sound switches on and off.' },
    { value: 'seasick', label: 'Seasick', tip: 'Vibrato: the pitch wobbles instead of the volume.' },
  ], apply: (v) => { const s = PRESETS[v]; mode.set(s.mode); shape.set(s.shape); kRate.set(s.rate); kDepth.set(s.depth); } });

  const pedal = SD.pedal({ name: 'Wobble Lamp', sub: 'tremolo · vibrato', fx, top: mode.el, knobs: [kRate, kDepth],
    middle: h('div', { class: 'ctl-group' }, h('span', { class: 'ctl-label' }, 'lfo shape'), shape.el) });

  const flow = SD.flow({ height: 100, on: () => pedal.on, draw(d) {
    const y = 26, y2 = 78, p = fx.params, trem = p.mode === 'tremolo';
    d.io(12, y, 'in'); d.io(288, y, 'out');
    d.wire([[16, y], [104, y]]);
    d.box(150, y, 88, trem ? 'volume knob' : 'tiny delay', { part: 'target' });
    d.wire([[194, y], [283, y]]);
    d.box(150, y2, 88, `LFO · ${p.rate.toFixed(1)} Hz`, { part: 'lfo', ctl: true });
    d.wire([[150, y2 - 12], [150, y + 13]], { ctl: true, part: 'amount' });
    d.note(158, 56, trem ? `turns it ±${Math.round(p.depth * 50)}%` : 'stretches it = pitch bend', { anchor: 'start', ctl: true });
  } });

  const lfoC = SD.canvas({ label: 'The LFO', hint: 'a slow wave that turns a knob for you', height: 110 });
  const sig = SD.canvas({ label: 'What you hear', hint: 'same 2 seconds, lined up', height: 170 });

  // Both graphs share one time window and frame so the LFO lines up with its effect.
  const WIN = 2, FR = { L: 14, R: 70, T: 10, B: 18 };
  const lfoAt = (t) => fx.lfo.value(t);
  const geom = (cv, T = FR.T) => {
    const { w, h: H } = cv, pw = w - FR.L - FR.R, mid = T + (H - T - FR.B) / 2;
    return { w, H, pw, mid, A: (H - T - FR.B) / 2 - 2, x: (f) => FR.L + f * pw };
  };
  const sample = (n, fn) => { const now = ctx.currentTime, out = []; for (let i = 0; i <= n; i++) out.push(fn(now - WIN + (i / n) * WIN, i / n)); return out; };
  const timeLabels = (g, G) => {
    g.font = '10px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3;
    g.textAlign = 'left'; g.fillText('2 s ago', FR.L, G.H - 4);
    g.textAlign = 'right'; g.fillText('now', FR.L + G.pw, G.H - 4);
  };
  const rightLabel = (g, G, y, text, col) => {
    g.font = '10px "DM Mono", monospace'; g.fillStyle = col || SD.COL.ink2; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(text, FR.L + G.pw + 8, y); g.textBaseline = 'alphabetic';
  };
  const hline = (g, G, y, col, dash) => { g.strokeStyle = col; g.lineWidth = 1; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(FR.L, y); g.lineTo(FR.L + G.pw, y); g.stroke(); g.setLineDash([]); };

  lfoC.draw = () => {
    const { g } = lfoC;
    if (!lfoC.w) return;
    const G = geom(lfoC), on = pedal.on;
    g.clearRect(0, 0, G.w, G.H);
    hline(g, G, G.mid, SD.COL.grid2);
    const pts = sample(Math.floor(G.pw), (t, f) => [G.x(f), G.mid - (on ? lfoAt(t) : 0) * G.A]);
    SD.strokePath(g, pts, on ? accent : SD.COL.ink3, 2.5);
    const [dx, dy] = pts[pts.length - 1];
    // the knob it is turning, labelled with what that knob controls
    const kx = G.w - 30, ky = G.mid - 6;
    g.setLineDash([3, 3]); g.strokeStyle = SD.alpha(accent, 0.6); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(dx, dy); g.lineTo(kx - 15, ky); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(kx, ky, 13, 0, Math.PI * 2); g.fillStyle = '#efe4cc'; g.fill(); g.lineWidth = 2; g.strokeStyle = SD.COL.ink; g.stroke();
    const ang = -Math.PI / 2 + (on ? lfoAt(ctx.currentTime) : 0) * fx.params.depth * 2.2;
    g.beginPath(); g.moveTo(kx, ky); g.lineTo(kx + Math.cos(ang) * 10, ky + Math.sin(ang) * 10); g.lineWidth = 3; g.stroke();
    g.font = '10px "DM Mono", monospace'; g.fillStyle = SD.COL.ink2; g.textAlign = 'center';
    g.fillText(fx.params.mode === 'tremolo' ? 'volume' : 'pitch', kx, ky + 27);
    g.beginPath(); g.arc(dx, dy, 5, 0, Math.PI * 2); g.fillStyle = on ? accent : SD.COL.ink3; g.fill();
    timeLabels(g, G);
  };

  sig.draw = () => {
    const { g } = sig;
    if (!sig.w) return;
    const G = geom(sig, 26), on = pedal.on, p = fx.params, n = Math.floor(G.pw);
    g.clearRect(0, 0, G.w, G.H);
    if (p.mode === 'tremolo') {
      // volume envelope drawn like a clip in a DAW: taller = louder
      const amp = (t) => (on ? 1 - p.depth / 2 + (p.depth / 2) * lfoAt(t) : 1);
      const top = sample(n, (t, f) => [G.x(f), G.mid - amp(t) * G.A]);
      g.beginPath(); top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      for (let i = top.length - 1; i >= 0; i--) g.lineTo(top[i][0], 2 * G.mid - top[i][1]);
      g.closePath(); g.fillStyle = SD.alpha(on ? accent : SD.COL.ink3, on ? 0.35 : 0.2); g.fill();
      SD.strokePath(g, top, on ? accent : SD.COL.ink3, 2);
      SD.strokePath(g, top.map(([x, y]) => [x, 2 * G.mid - y]), on ? accent : SD.COL.ink3, 2);
      hline(g, G, G.mid, SD.COL.grid2);
      rightLabel(g, G, G.mid - G.A, 'loud');
      if (on && p.depth > 0.15) rightLabel(g, G, G.mid - (1 - p.depth) * G.A, 'quiet', SD.COL.ink3);
    } else {
      // pitch over time: the line bends above (sharp) and below (flat) the note you played
      const S = G.A * 0.9;
      const pts = sample(n, (t, f) => [G.x(f), G.mid - (on ? p.depth * lfoAt(t) : 0) * S]);
      g.beginPath(); g.moveTo(pts[0][0], G.mid); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(pts[pts.length - 1][0], G.mid); g.closePath();
      g.fillStyle = SD.alpha(accent, 0.15); g.fill();
      hline(g, G, G.mid, SD.COL.ink3, [5, 4]);
      SD.strokePath(g, pts, on ? accent : SD.COL.ink3, 2.5);
      rightLabel(g, G, G.mid, 'your note');
      rightLabel(g, G, G.mid - S, '↑ sharp', SD.COL.ink3);
      rightLabel(g, G, G.mid + S, '↓ flat', SD.COL.ink3);
    }
    g.font = '11px "DM Mono", monospace'; g.fillStyle = SD.COL.ink2; g.textAlign = 'left';
    g.fillText(!on ? 'bypassed: nothing moves' : p.mode === 'tremolo' ? 'volume swells and dips' : 'pitch bends up and down', FR.L + 2, 14);
    timeLabels(g, G);
  };
  SD.onFrame(() => { lfoC.draw(); sig.draw(); }, document.getElementById('bench-trem'));

  SD.bench('trem', { label: 'Wobble Lamp tremolo', sources: ['held', 'arp', 'note', 'sine'], source: 'held', dest: () => fx.inputNode, pedal, flow, flowIn: 'graphs', presets, graphs: [lfoC, sig] });
})();
