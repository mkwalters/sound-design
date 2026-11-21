/* Chapter 6: chorus & flanger. */
(function () {
  const { h, ctx } = SD;
  const accent = SD.accentOf('chorus');
  const fx = SD.fx.chorus();
  fx.outputNode.connect(SD.master);

  const PRESETS = {
    chorus: { rate: 0.8, depth: 0.5, delay: 18, feedback: 0, mix: 0.5 },
    flanger: { rate: 0.18, depth: 0.85, delay: 2.6, feedback: 0.72, mix: 0.5 },
    jet: { rate: 0.08, depth: 0.95, delay: 3.5, feedback: 0.88, mix: 0.5 },
  };
  const ms = (v) => (v < 10 ? v.toFixed(1) : Math.round(v)) + ' ms';
  const kRate = SD.knob({ label: 'Rate', tip: 'Speed of the wobble.', min: 0.05, max: 5, value: 0.8, scale: 'log', small: true, format: (v) => v.toFixed(2) + ' Hz', onInput: (v) => fx.set('rate', v) });
  const kDepth = SD.knob({ label: 'Depth', tip: 'How far the delay sways. More = more detuned.', min: 0, max: 1, value: 0.5, small: true, format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('depth', v) });
  const kDelay = SD.knob({ label: 'Delay', tip: 'Gap between the original and the copy. Short = flanger, long = chorus.', min: 0.5, max: 30, value: 18, scale: 'log', small: true, format: ms, onInput: (v) => fx.set('delay', v) });
  const kFb = SD.knob({ label: 'Feedback', tip: 'Feeds the copy back in. More = sharper, more metallic.', min: -0.9, max: 0.9, value: 0, small: true, format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('feedback', v) });
  const kMix = SD.knob({ label: 'Mix', tip: 'Original vs. copy. 50% gives the strongest effect.', min: 0, max: 1, value: 0.5, small: true, format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('mix', v) });
  const knobs = { rate: kRate, depth: kDepth, delay: kDelay, feedback: kFb, mix: kMix };
  const preset = SD.segmented({ label: 'Preset', options: [{ value: 'chorus', label: 'Chorus', tip: 'Long delay, no feedback: lush shimmer.' }, { value: 'flanger', label: 'Flanger', tip: 'Tiny delay plus feedback: whoosh.' }, { value: 'jet', label: 'Jet plane', tip: 'An extreme, slow flanger.' }],
    value: 'chorus', onChange: (v) => Object.entries(PRESETS[v]).forEach(([k, val]) => knobs[k].set(val)) });

  const pedal = SD.pedal({ name: 'Shimmer Twins', sub: 'chorus · flanger', fx, top: preset.el, knobs: Object.values(knobs) });

  const dly = SD.canvas({ label: 'Delay time', hint: 'wobbled by the LFO', height: 120 });
  const comb = SD.canvas({ label: 'Frequency response', hint: 'the comb filter', height: 240 });

  const WIN = 4;
  dly.draw = () => {
    const { g, w, h: H } = dly;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const p = fx.params, now = ctx.currentTime;
    const maxMs = Math.max(6, (p.delay + fx.depthSec() * 1000) * 1.15);
    const Y = (sec) => H - 16 - ((sec * 1000) / maxMs) * (H - 30);
    g.font = '10px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3; g.strokeStyle = SD.COL.grid; g.lineWidth = 1;
    [0, maxMs / 2, maxMs].forEach((m) => { const y = Y(m / 1000); g.beginPath(); g.moveTo(44, y); g.lineTo(w, y); g.stroke(); g.textAlign = 'right'; g.fillText(m.toFixed(m < 10 ? 1 : 0) + 'ms', 40, y + 3); });
    const pts = [];
    for (let i = 0; i <= 240; i++) { const t = now - WIN + (i / 240) * WIN; pts.push([44 + (i / 240) * (w - 54), Y(fx.curDelay(t))]); }
    SD.strokePath(g, pts, accent, 2.8);
    const last = pts[pts.length - 1];
    g.beginPath(); g.arc(last[0], last[1], 5, 0, Math.PI * 2); g.fillStyle = accent; g.fill();
  };

    const SUB = 8; // sub-samples per pixel column
  comb.draw = () => {
    if (!comb.w) return;
    const fr = SD.freqFrame(comb, { dbMin: -30, dbMax: 18, dbStep: 6 });
    const { g } = comb;
    const x0 = fr.x(20), x1 = fr.x(20000), cols = Math.max(1, Math.floor(x1 - x0));
    const tau = fx.curDelay(ctx.currentTime), fb = fx.params.feedback, wg = fx.wetAmt(), dg = fx.dryAmt();
    const resp = (f) => {
      if (!pedal.on) return 0;
      const w0 = 2 * Math.PI * f * tau;
      // H = dry + wet · e^{-jw} / (1 − fb·e^{-jw})
      const cr = Math.cos(w0), ci = -Math.sin(w0);
      const denR = 1 - fb * cr, denI = -fb * ci, den = denR * denR + denI * denI;
      const dr = (cr * denR + ci * denI) / den, di = (ci * denR - cr * denI) / den;
      return SD.clamp(SD.gainToDb(Math.hypot(dg + wg * dr, wg * di)), -32, 20);
    };
    const top = [], bot = [];
    for (let c = 0; c <= cols; c++) {
      let mn = 99, mx = -99;
      for (let k = 0; k < SUB; k++) {
        const f = 20 * Math.pow(1000, (c + k / SUB) / cols);
        const v = resp(f); if (v < mn) mn = v; if (v > mx) mx = v;
      }
      top.push([x0 + c, fr.y(mx)]); bot.push([x0 + c, fr.y(mn)]);
    }
    // band between min and max: where teeth are denser than a pixel it reads as a solid band
    g.beginPath(); top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
    g.closePath(); g.fillStyle = SD.alpha(accent, 0.45); g.fill();
    g.beginPath(); top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.lineTo(x1, fr.y(-30)); g.lineTo(x0, fr.y(-30)); g.closePath();
    g.fillStyle = SD.alpha(accent, 0.1); g.fill();
    SD.strokePath(g, top, accent, 2.2);
    SD.strokePath(g, bot, SD.alpha(accent, 0.9), 1.2);
  };
  SD.onFrame(() => { dly.draw(); comb.draw(); }, document.getElementById('bench-chorus'));

  SD.bench('chorus', { label: 'Shimmer Twins', sources: ['saw', 'sine', 'chords', 'lick', 'drums'], source: 'saw', dest: () => fx.inputNode, pedal, graphs: [dly, comb] });
})();
