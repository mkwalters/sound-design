/* Chapter 4: filters & wah, with a rockable treadle. */
(function () {
  const { h } = SD;
  const accent = SD.accentOf('filter');
  const fx = SD.fx.filter();
  fx.outputNode.connect(SD.master);

  // --- treadle ---
  const treadle = h('div', { class: 'treadle', role: 'slider', tabindex: 0, 'aria-label': 'Wah pedal position (drag up and down)', 'data-tip': 'Drag up for toe down (bright), down for heel down (dark).', 'data-tip-title': 'Treadle' });
  const readout = h('div', { class: 'treadle-readout' }, '');
  const renderTreadle = () => {
    const pos = fx.curPos;
    treadle.style.transform = `rotateX(${(pos - 0.5) * 34}deg)`;
    readout.textContent = Math.round(fx.freqFor(pos)) + ' Hz';
    treadle.setAttribute('aria-valuenow', String(Math.round(pos * 100)));
  };
  SD.dragControl(treadle, () => (fx.params.auto === 'off' ? fx.params.pos : fx.curPos), (n) => {
    n = SD.clamp(n, 0, 1);
    if (fx.params.auto !== 'off') { autoSeg.set('off'); }
    fx.set('pos', n);
  }, { vertical: true, sens: 160 });

  const mode = SD.segmented({ label: 'Filter type', options: [
    { value: 'wah', label: 'Wah', tip: 'A narrow peak that boosts one band. Sweep it to talk.' },
    { value: 'lowpass', label: 'Low‑pass', tip: 'Lets the lows through and cuts the highs. Your tone knob.' },
    { value: 'highpass', label: 'High‑pass', tip: 'Lets the highs through and cuts the lows. Thin and tinny.' },
  ], value: 'wah', onChange: (v) => fx.set('mode', v) });
  const kRes = SD.knob({ label: 'Resonance', tip: 'Height of the peak. More = more vocal and squelchy.', min: 0, max: 1, value: 0.45, small: true, format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('res', v) });
  const kRate = SD.knob({ label: 'LFO rate', tip: 'How fast the automatic sweep moves.', min: 0.1, max: 6, value: 1.2, scale: 'log', small: true, format: (v) => v.toFixed(2) + ' Hz', onInput: (v) => fx.set('rate', v) });
  const kSens = SD.knob({ label: 'Sensitivity', tip: 'How far harder picking opens the filter.', min: 0, max: 1, value: 0.5, small: true, format: (v) => Math.round(v * 100) + '%', onInput: (v) => fx.set('sens', v) });
  const autoSeg = SD.segmented({ small: true, label: 'Auto mode', options: [
    { value: 'off', label: 'Foot', tip: 'You control it with the treadle.' },
    { value: 'lfo', label: 'LFO', tip: 'A robot foot sweeps it back and forth.' },
    { value: 'env', label: 'Envelope', tip: 'Follows your picking: hit harder and it opens up.' },
  ], value: 'off', onChange: (v) => { fx.set('auto', v); showAuto(); } });
  const showAuto = () => {
    kRate.el.style.display = fx.params.auto === 'lfo' ? '' : 'none';
    kSens.el.style.display = fx.params.auto === 'env' ? '' : 'none';
  };

  const pedal = SD.pedal({
    name: 'Quack', sub: 'wah · filter', fx, cls: 'wah', top: mode.el,
    middle: h('div', { class: 'wah-row' },
      h('div', { class: 'wah-ctls' },
        h('div', { class: 'ctl-group' }, h('span', { class: 'ctl-label' }, 'auto'), autoSeg.el),
        h('div', { class: 'pedal-knobs' }, kRes.el, kRate.el, kSens.el)),
      h('div', { class: 'treadle-wrap' }, treadle, readout)),
  });
  showAuto();

  const resp = SD.canvas({ label: 'Frequency response', hint: 'lows ← → highs', height: 300 });
  const NF = 260, freqs = SD.logFreqs(NF), mag = new Float32Array(NF), ph = new Float32Array(NF);
  const spec = new Float32Array(fx.postA.frequencyBinCount);
  const binHz = SD.ctx.sampleRate / fx.postA.fftSize;
  resp.draw = () => {
    if (!resp.w) return;
    const { g } = resp;
    const fr = SD.freqFrame(resp, { dbMin: -36, dbMax: 24, dbStep: 12 });
    // live spectrum
    const playing = SD.player.current && SD.player.current.owner === bench.transport.owner;
    if (playing) {
      fx.postA.getFloatFrequencyData(spec);
      g.beginPath(); g.moveTo(fr.x(20), resp.h - fr.B);
      for (let i = 0; i < NF; i++) {
        const bin = Math.min(spec.length - 1, Math.round(freqs[i] / binHz));
        const v = SD.clamp((spec[bin] + 100) / 70, 0, 1);
        g.lineTo(fr.x(freqs[i]), resp.h - fr.B - v * (resp.h - fr.B - fr.T) * 0.9);
      }
      g.lineTo(fr.x(20000), resp.h - fr.B); g.closePath();
      g.fillStyle = SD.alpha(accent, 0.16); g.fill();
    }
    // filter response (wet*H + dry, as complex sum)
    const pts = [];
    if (pedal.on) {
      fx.vis.getFrequencyResponse(freqs, mag, ph);
      const wg = fx.wetGain(), dg = fx.dryGain();
      for (let i = 0; i < NF; i++) {
        const re = wg * mag[i] * Math.cos(ph[i]) + dg, im = wg * mag[i] * Math.sin(ph[i]);
        pts.push([fr.x(freqs[i]), fr.y(SD.clamp(SD.gainToDb(Math.hypot(re, im)), -40, 26))]);
      }
    } else for (let i = 0; i < NF; i++) pts.push([fr.x(freqs[i]), fr.y(0)]);
    SD.strokePath(resp.g, pts, accent, 3.2);
    const cf = fx.freqFor(fx.curPos);
    if (pedal.on) {
      g.fillStyle = SD.COL.ink; g.font = '11px "DM Mono", monospace'; g.textAlign = 'center';
      g.fillText(fx.params.mode === 'wah' ? 'peak' : 'cutoff', SD.clamp(fr.x(cf), 40, resp.w - 30), fr.T + 12);
      g.strokeStyle = SD.alpha('#2b2320', 0.25); g.setLineDash([3, 4]);
      g.beginPath(); g.moveTo(fr.x(cf), fr.T + 18); g.lineTo(fr.x(cf), resp.h - fr.B); g.stroke(); g.setLineDash([]);
    }
  };
  SD.onFrame(() => { resp.draw(); renderTreadle(); }, document.getElementById('bench-filter'));
  renderTreadle();

  const bench = SD.bench('filter', { label: 'Quack wah', sources: ['saw', 'pulses', 'lick', 'chords', 'drums'], source: 'saw', dest: () => fx.inputNode, pedal, graphs: [resp] });
})();
