/* Chapter 7: phaser. */
(function () {
  const { h, ctx } = SD;
  const accent = SD.accentOf('phaser');
  const fx = SD.fx.phaser();
  fx.outputNode.connect(SD.master);

  const kRate = SD.knob({ label: 'Rate', tip: 'Speed of the sweep.', min: 0.05, max: 5, value: 0.4, scale: 'log', part: 'lfo', format: (v) => v.toFixed(2) + ' Hz', onInput: (v) => fx.set('rate', v) });
  const kDepth = SD.knob({ label: 'Depth', tip: 'How far the notches travel.', min: 0, max: 1, value: 0.75, part: 'lfo', format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('depth', v) });
  const kRes = SD.knob({ label: 'Resonance', tip: 'Sharper, deeper, more liquid notches.', min: 0, max: 1, value: 0.25, part: 'ap', format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('res', v) });
  const stages = SD.segmented({ label: 'Stages', options: [2, 4, 6, 8].map((n) => ({ value: n, label: String(n), tip: `${n} filter stages → ${n / 2} notch${n > 2 ? 'es' : ''}.` })), value: 4, part: 'ap', onChange: (v) => fx.set('stages', v) });

  const PRESETS = {
    slow: { rate: 0.22, depth: 0.8, res: 0.25, stages: 4 },
    funky: { rate: 1.6, depth: 0.6, res: 0.45, stages: 4 },
    gentle: { rate: 0.6, depth: 0.5, res: 0.1, stages: 2 },
    space: { rate: 0.1, depth: 1, res: 0.7, stages: 8 },
  };
  const presets = SD.presetBar({ options: [
    { value: 'slow', label: 'Slow swirl', tip: 'The classic 70s four‑stage sweep.' },
    { value: 'funky', label: 'Funky', tip: 'Faster and sharper: a bubbling rhythm part.' },
    { value: 'gentle', label: 'Gentle', tip: 'Two stages, one notch: barely‑there movement.' },
    { value: 'space', label: 'Deep space', tip: 'Eight stages, very slow, lots of resonance.' },
  ], apply: (v) => { const s = PRESETS[v]; stages.set(s.stages); kRate.set(s.rate); kDepth.set(s.depth); kRes.set(s.res); } });

  const pedal = SD.pedal({ name: 'Swoosh', sub: 'phase shifter', fx, knobs: [kRate, kDepth, kRes],
    middle: h('div', { class: 'ctl-group' }, h('span', { class: 'ctl-label' }, 'stages'), stages.el) });

  const flow = SD.flow({ height: 124, on: () => pedal.on, draw(d) {
    const y = 24, y2 = 62, y3 = 104, p = fx.params;
    d.io(12, y, 'in'); d.io(288, y, 'out'); d.dot(38, y);
    d.wire([[16, y], [241, y]]); d.note(140, y - 7, 'original');
    d.wire([[38, y], [38, y2], [72, y2]]);
    d.box(132, y2, 120, `${p.stages} all‑pass stages`, { part: 'ap' });
    d.wire([[192, y2], [250, y2], [250, y + 9]]);
    d.sum(250, y); d.wire([[259, y], [283, y]]);
    d.note(200, y2 + 22, 'shift the timing', { anchor: 'start' });
    d.box(132, y3, 96, `LFO · ${p.rate.toFixed(2)} Hz`, { part: 'lfo', ctl: true });
    d.wire([[132, y3 - 12], [132, y2 + 13]], { ctl: true });
    d.note(124, y3 - 18, 'sweeps', { anchor: 'end', ctl: true });
  } });

  const resp = SD.canvas({ label: 'Frequency response', hint: 'notches glide with the LFO', height: 260 });
  const NF = 300, freqs = SD.logFreqs(NF), mag = new Float32Array(NF), ph = new Float32Array(NF);
  resp.draw = () => {
    if (!resp.w) return;
    const { g } = resp;
    const fr = SD.freqFrame(resp, { dbMin: -36, dbMax: 12, dbStep: 12 });
    const pts = [];
    let notches = 0;
    if (pedal.on) {
      fx.vis.frequency.value = fx.curF;
      fx.vis.getFrequencyResponse(freqs, mag, ph);
      const S = fx.params.stages, dbs = new Float32Array(NF);
      for (let i = 0; i < NF; i++) {
        const tp = ph[i] * (S / 2); // total phase shift through all stages
        const re = 0.62 + 0.62 * Math.cos(tp), im = 0.62 * Math.sin(tp);
        dbs[i] = SD.gainToDb(Math.hypot(re, im));
        pts.push([fr.x(freqs[i]), fr.y(SD.clamp(dbs[i], -36, 12))]);
      }
      for (let i = 1; i < NF - 1; i++) if (dbs[i] < dbs[i - 1] && dbs[i] <= dbs[i + 1] && dbs[i] < -10) notches++;
    } else for (let i = 0; i < NF; i++) pts.push([fr.x(freqs[i]), fr.y(0)]);
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.lineTo(fr.x(20000), fr.y(-36)); g.lineTo(fr.x(20), fr.y(-36)); g.closePath();
    g.fillStyle = SD.alpha(accent, 0.14); g.fill();
    SD.strokePath(g, pts, accent, 3);
    g.font = '11px "DM Mono", monospace'; g.fillStyle = SD.COL.ink2; g.textAlign = 'left';
    if (pedal.on) g.fillText(`${notches} notch${notches === 1 ? '' : 'es'}`, fr.L + 8, fr.T + 14);
  };
  SD.onFrame(() => resp.draw(), document.getElementById('bench-phaser'));

  SD.bench('phaser', { label: 'Swoosh phaser', sources: ['held', 'funk', 'arp', 'saw'], source: 'held', dest: () => fx.inputNode, pedal, flow, flowIn: 'graphs', presets, graphs: [resp] });
})();
