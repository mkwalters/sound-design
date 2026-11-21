/* Chapter 8: delay & echo. */
(function () {
  const { h } = SD;
  const accent = SD.accentOf('delay');
  const fx = SD.fx.delay();
  fx.outputNode.connect(SD.master);

  const PRESETS = {
    doubling: { time: 0.032, feedback: 0, mix: 0.55, tone: 0.8 },
    slapback: { time: 0.11, feedback: 0.08, mix: 0.5, tone: 0.55 },
    echo: { time: 0.6, feedback: 0.42, mix: 0.45, tone: 0.6 },
    dotted: { time: 0.45, feedback: 0.45, mix: 0.45, tone: 0.65 },
    ambient: { time: 0.72, feedback: 0.78, mix: 0.5, tone: 0.25 },
  };
  const kTime = SD.knob({ label: 'Time', tip: 'The gap between repeats.', min: 0.02, max: 1.5, value: 0.375, scale: 'log', format: (v) => Math.round(v * 1000) + ' ms', onInput: (v) => { fx.set('time', v); ir.draw(); } });
  const kFb = SD.knob({ label: 'Feedback', tip: 'How many repeats. High = they go on and on.', min: 0, max: 0.95, value: 0.4, format: (v) => Math.round(v * 100) + '%', onInput: (v) => { fx.set('feedback', v); ir.draw(); } });
  const kMix = SD.knob({ label: 'Mix', tip: 'Echo volume vs. your playing.', min: 0, max: 1, value: 0.45, format: (v) => Math.round(v * 100) + '%', onInput: (v) => { fx.set('mix', v); ir.draw(); } });
  const kTone = SD.knob({ label: 'Tone', tip: 'Darker repeats = vintage tape. Brighter = clean digital.', min: 0, max: 1, value: 0.6, format: (v) => (v < 0.35 ? 'tape ' : v > 0.75 ? 'digital ' : '') + Math.round(v * 100) + '%', onInput: (v) => { fx.set('tone', v); ir.draw(); } });
  const knobs = { time: kTime, feedback: kFb, mix: kMix, tone: kTone };
  const preset = SD.segmented({ label: 'Preset', options: [
    { value: 'doubling', label: 'Doubling', tip: 'Too fast to hear as an echo. Just sounds thicker.' },
    { value: 'slapback', label: 'Slapback', tip: 'One quick bounce. 50s rockabilly.' },
    { value: 'echo', label: 'Echo', tip: 'Distinct repeats that fade away.' },
    { value: 'dotted', label: 'Dotted 8th', tip: 'Repeats land between the beats: cascading, U2‑style.' },
    { value: 'ambient', label: 'Ambient', tip: 'Long, dark, endless wash.' },
  ], value: null, onChange: (v) => Object.entries(PRESETS[v]).forEach(([k, val]) => knobs[k].set(val)) });

  // tap tempo
  const tap = h('button', { type: 'button', class: 'footswitch tap', 'aria-label': 'Tap tempo', 'data-tip': 'Tap twice or more in rhythm to set the delay time.', 'data-tip-title': 'Tap tempo' });
  let taps = [];
  tap.addEventListener('click', () => {
    const t = performance.now() / 1000;
    taps = taps.filter((x) => t - x < 2.2);
    taps.push(t);
    if (taps.length >= 2) {
      const iv = []; for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
      const avg = iv.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, iv.length);
      kTime.set(SD.clamp(avg, 0.05, 1.5));
      preset.set(null, true);
    }
    pedal.led.classList.add('flash');
    setTimeout(() => pedal.led.classList.remove('flash'), 90);
  });

  const pedal = SD.pedal({ name: 'Canyon Echo', sub: 'delay', fx, knobs: [kTime, kFb, kMix, kTone], extraFoot: h('div', { class: 'pedal-foot' }, h('span', { style: { height: '14px' } }), tap, h('span', { class: 'fs-hint' }, 'tap')), onToggle: () => ir.draw() });
  // Presets sit above the bench graphs rather than on the pedal (there are five of them).
  const ir = SD.canvas({ label: 'Impulse response', hint: 'one click in → this comes out', height: 260 });

  ir.draw = () => {
    const { g, w, h: H } = ir;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const p = fx.params, L = 30, R = 10, B = 22, T = 18;
    const span = Math.max(1.2, Math.min(6, pedal.on ? p.time * Math.max(4, Math.log(0.02) / Math.log(Math.max(0.01, p.feedback))) + 0.2 : 1.2));
    const X = (t) => L + (t / span) * (w - L - R), Y = (a) => H - B - a * (H - B - T);
    g.font = '10.5px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3; g.textAlign = 'center';
    const step = span > 3 ? 1 : span > 1.5 ? 0.5 : 0.25;
    g.strokeStyle = SD.COL.grid; g.lineWidth = 1;
    for (let t = 0; t <= span + 1e-6; t += step) { g.beginPath(); g.moveTo(X(t), T); g.lineTo(X(t), H - B); g.stroke(); g.fillText(t.toFixed(2).replace(/\.?0+$/, '') + 's', X(t), H - 6); }
    g.strokeStyle = SD.COL.grid2; g.beginPath(); g.moveTo(L, H - B); g.lineTo(w - R, H - B); g.stroke();
    const bar = (t, a, color, lbl, blur) => {
      const x = X(t), bw = 7 + blur * 10;
      const grd = g.createLinearGradient(0, Y(a), 0, H - B);
      grd.addColorStop(0, color); grd.addColorStop(1, SD.alpha(color === SD.COL.ink ? '#2b2320' : accent, 0.35));
      g.fillStyle = grd;
      g.beginPath(); g.roundRect ? g.roundRect(x - bw / 2, Y(a), bw, H - B - Y(a), [5, 5, 0, 0]) : g.rect(x - bw / 2, Y(a), bw, H - B - Y(a)); g.fill();
      if (lbl) { g.fillStyle = SD.COL.ink2; g.fillText(lbl, x, Y(a) - 6); }
    };
    const dryA = pedal.on ? 1 - p.mix * 0.35 : 1;
    bar(0, dryA, SD.COL.ink, 'you', 0);
    if (pedal.on) {
      const toneLoss = 0.55 + 0.45 * p.tone;
      let a = p.mix * 1.1 * toneLoss, k = 1;
      while (k * p.time <= span && a > 0.008 && k < 200) {
        bar(k * p.time, Math.min(1, a), accent, k <= 3 && p.time * (w / span) > 34 ? 'echo ' + k : '', (1 - p.tone) * Math.min(1, k / 5));
        a *= p.feedback * toneLoss; k++;
      }
      if (p.time < 0.05) { g.fillStyle = SD.COL.ink2; g.textAlign = 'left'; g.fillText('← too close to hear as an echo: it just sounds thicker', X(p.time) + 14, T + 8); }
    }
  };

  const bench = SD.bench('delay', { label: 'Canyon Echo delay', sources: ['sparse', 'stab', 'lick', 'blip'], source: 'sparse', dest: () => fx.inputNode, pedal, graphs: [ir], headExtra: preset.el });
})();
