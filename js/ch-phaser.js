/* Chapter 7: phaser. */
(function () {
  const { h, ctx } = SD;
  const accent = SD.accentOf('phaser');
  const fx = SD.fx.phaser();
  fx.outputNode.connect(SD.master);

  const kRate = SD.knob({ label: 'Rate', min: 0.05, max: 5, value: 0.4, scale: 'log', format: (v) => v.toFixed(2) + ' Hz', onInput: (v) => fx.set('rate', v) });
  const kDepth = SD.knob({ label: 'Depth', min: 0, max: 1, value: 0.75, format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('depth', v) });
  const kRes = SD.knob({ label: 'Resonance', min: 0, max: 1, value: 0.25, format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('res', v) });
  const stages = SD.segmented({ label: 'Stages', options: [2, 4, 6, 8].map((n) => ({ value: n, label: String(n) })), value: 4, onChange: (v) => fx.set('stages', v) });

  const pedal = SD.pedal({ name: 'Swoosh', sub: 'phase shifter', fx, knobs: [kRate, kDepth, kRes],
    middle: h('div', { class: 'ctl-group' }, h('span', { class: 'ctl-label' }, 'stages'), stages.el) });

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

  SD.bench('phaser', { label: 'Swoosh phaser', sources: ['chords', 'lick', 'chug', 'drums'], source: 'chords', dest: () => fx.inputNode, pedal, graphs: [resp] });
})();
