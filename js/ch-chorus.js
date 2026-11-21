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
  const kRate = SD.knob({ label: 'Rate', min: 0.05, max: 5, value: 0.8, scale: 'log', small: true, format: (v) => v.toFixed(2) + ' Hz', onInput: (v) => fx.set('rate', v) });
  const kDepth = SD.knob({ label: 'Depth', min: 0, max: 1, value: 0.5, small: true, format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('depth', v) });
  const kDelay = SD.knob({ label: 'Delay', min: 0.5, max: 30, value: 18, scale: 'log', small: true, format: ms, onInput: (v) => fx.set('delay', v) });
  const kFb = SD.knob({ label: 'Feedback', min: -0.9, max: 0.9, value: 0, small: true, format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('feedback', v) });
  const kMix = SD.knob({ label: 'Mix', min: 0, max: 1, value: 0.5, small: true, format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('mix', v) });
  const knobs = { rate: kRate, depth: kDepth, delay: kDelay, feedback: kFb, mix: kMix };
  const preset = SD.segmented({ label: 'Preset', options: [{ value: 'chorus', label: 'Chorus' }, { value: 'flanger', label: 'Flanger' }, { value: 'jet', label: 'Jet plane' }],
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

  let NF = 0, freqs = null;
  comb.draw = () => {
    if (!comb.w) return;
    const want = Math.floor(comb.w * 1.5);
    if (want !== NF) { NF = want; freqs = SD.logFreqs(NF); }
    const fr = SD.freqFrame(comb, { dbMin: -30, dbMax: 18, dbStep: 6 });
    const pts = [];
    if (pedal.on) {
      const tau = fx.curDelay(ctx.currentTime), fb = fx.params.feedback, wg = fx.wetAmt(), dg = fx.dryAmt();
      for (let i = 0; i < NF; i++) {
        const w0 = 2 * Math.PI * freqs[i] * tau;
        // D = e^{-jw} / (1 - fb e^{-jw})
        const cr = Math.cos(w0), ci = -Math.sin(w0);
        const denR = 1 - fb * cr, denI = -fb * ci, den = denR * denR + denI * denI;
        const dr = (cr * denR + ci * denI) / den, di = (ci * denR - cr * denI) / den;
        const re = dg + wg * dr, im = wg * di;
        pts.push([fr.x(freqs[i]), fr.y(SD.clamp(SD.gainToDb(Math.hypot(re, im)), -32, 20))]);
      }
    } else for (let i = 0; i < NF; i++) pts.push([fr.x(freqs[i]), fr.y(0)]);
    const { g } = comb;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.lineTo(fr.x(20000), fr.y(-30)); g.lineTo(fr.x(20), fr.y(-30)); g.closePath();
    g.fillStyle = SD.alpha(accent, 0.13); g.fill();
    SD.strokePath(g, pts, accent, 2.4);
  };
  SD.onFrame(() => { dly.draw(); comb.draw(); }, document.getElementById('bench-chorus'));

  SD.bench('chorus', { label: 'Shimmer Twins', sources: ['chords', 'lick', 'chug', 'drums'], source: 'chords', dest: () => fx.inputNode, pedal, graphs: [dly, comb] });
})();
