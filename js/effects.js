/* Effect factories. Each returns { inputNode, outputNode, params, set(k,v), setOn(bool), ... } */
(function () {
  const SD = window.SD, ctx = SD.ctx;
  SD.fx = {};
  const G = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const BQ = (type, f, q, gain) => {
    const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f;
    if (q != null) b.Q.value = q; if (gain != null) b.gain.value = gain; return b;
  };
  const smooth = (p, v, tc = 0.02) => p.setTargetAtTime(v, ctx.currentTime, tc);
  SD.BQ = BQ;

  /* Bypass wrapper + param plumbing. */
  function finish(fx, init) {
    const inp = G(), out = G(), dry = G(0), wet = G(1);
    inp.connect(fx.input);
    fx.output.connect(wet).connect(out);
    inp.connect(dry).connect(out);
    fx.inputNode = inp; fx.outputNode = out; fx.on = true;
    fx.setOn = (on) => { fx.on = on; smooth(wet.gain, on ? 1 : 0, 0.012); smooth(dry.gain, on ? 0 : 1, 0.012); };
    fx.set = (k, v) => { fx.params[k] = v; fx.apply(k); };
    fx.setMany = (obj) => { Object.assign(fx.params, obj); Object.keys(obj).forEach((k) => fx.apply(k)); };
    (init || Object.keys(fx.params)).forEach((k) => fx.apply(k));
    return fx;
  }

  /* LFO whose phase we can also compute in JS (for drawing in sync with what you hear). */
  function LFO(rate, type = 'sine') {
    const osc = ctx.createOscillator();
    osc.type = type; osc.frequency.value = rate;
    osc.start();
    const st = { rate, ph0: 0, t0: ctx.currentTime, type };
    return {
      osc,
      get rate() { return st.rate; },
      setRate(r) { const t = ctx.currentTime; st.ph0 = this.phase(t); st.t0 = t; st.rate = r; osc.frequency.setValueAtTime(r, t); },
      setType(tp) { st.type = tp; osc.type = tp; },
      phase(t = ctx.currentTime) { return st.ph0 + (t - st.t0) * st.rate; },
      value(t = ctx.currentTime) { return SD.lfoShape(st.type, this.phase(t)); },
    };
  }
  /* LFO purely in JS (drives params from the frame loop). */
  function JSLFO(rate) {
    const st = { rate, ph0: 0, t0: ctx.currentTime };
    return {
      get rate() { return st.rate; },
      setRate(r) { const t = ctx.currentTime; st.ph0 = this.phase(t); st.t0 = t; st.rate = r; },
      phase(t = ctx.currentTime) { return st.ph0 + (t - st.t0) * st.rate; },
      value(t) { return Math.sin(2 * Math.PI * this.phase(t)); },
    };
  }
  SD.lfoShape = (type, ph) => {
    const p = ph - Math.floor(ph);
    if (type === 'square') return p < 0.5 ? 1 : -1;
    if (type === 'triangle') return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
    return Math.sin(2 * Math.PI * p);
  };

  // =============== DRIVE ===============
  const CURVES = {
    overdrive: (x) => Math.tanh(x),
    distortion: (x) => x / Math.pow(1 + Math.pow(Math.abs(x), 5), 0.2),
    fuzz: (x) => (x >= 0 ? 1 - Math.exp(-x) : -0.62 * (1 - Math.exp(1.9 * x))),
  };
  const GAIN = {
    overdrive: (d) => 0.5 + 16 * d * d,
    distortion: (d) => 0.8 + 70 * d * d,
    fuzz: (d) => 2 + 200 * d * d,
  };
  SD.driveCurve = (mode, drive) => {
    const f = CURVES[mode], g = GAIN[mode](drive);
    let norm = 0;
    for (let i = 0; i <= 200; i++) norm = Math.max(norm, Math.abs(f(g * (i / 100 - 1))));
    return (x) => f(g * x) / norm;
  };
  SD.fx.drive = function () {
    const input = G(), hp = BQ('highpass', 90, 0.7), mid = BQ('peaking', 750, 0.9, 5);
    const shaper = ctx.createWaveShaper(); shaper.oversample = '4x';
    const dc = BQ('highpass', 25, 0.7), tone = BQ('lowpass', 4000, 0.6), level = G(0.6);
    input.connect(hp).connect(mid).connect(shaper).connect(dc).connect(tone).connect(level);
    const fx = { input, output: level, params: { mode: 'overdrive', drive: 0.6, tone: 0.55, level: 0.7 } };
    fx.apply = (k) => {
      const p = fx.params;
      if (k === 'mode' || k === 'drive') {
        const fn = SD.driveCurve(p.mode, p.drive), n = 4096, c = new Float32Array(n);
        for (let i = 0; i < n; i++) c[i] = fn((i / (n - 1)) * 2 - 1);
        shaper.curve = c;
        mid.gain.value = { overdrive: 6, distortion: 1, fuzz: -3 }[p.mode];
        fx.apply('level');
      }
      if (k === 'tone') smooth(tone.frequency, 500 * Math.pow(12000 / 500, p.tone));
      if (k === 'level') {
        const comp = 1 / (1 + p.drive * (p.mode === 'fuzz' ? 2 : p.mode === 'distortion' ? 1.6 : 1.1));
        smooth(level.gain, p.level * 0.5 * comp);
      }
    };
    return finish(fx, ['mode', 'tone']);
  };

  // =============== COMPRESSOR ===============
  SD.fx.comp = function () {
    const input = G(), comp = ctx.createDynamicsCompressor(), makeup = G(1);
    const preA = ctx.createAnalyser(), postA = ctx.createAnalyser();
    preA.fftSize = postA.fftSize = 1024;
    input.connect(comp).connect(makeup);
    input.connect(preA); makeup.connect(postA);
    comp.knee.value = 4;
    const fx = { input, output: makeup, comp, preA, postA, params: { threshold: -28, ratio: 4, attack: 0.008, release: 0.22, makeup: 0 } };
    fx.apply = (k) => {
      const p = fx.params;
      if (k === 'threshold') smooth(comp.threshold, p.threshold);
      if (k === 'ratio') smooth(comp.ratio, p.ratio);
      if (k === 'attack') comp.attack.value = p.attack;
      if (k === 'release') comp.release.value = p.release;
      if (k === 'makeup') smooth(makeup.gain, SD.dbToGain(p.makeup) * 0.85);
    };
    return finish(fx);
  };

  // =============== FILTER / WAH ===============
  SD.fx.filter = function () {
    const input = G(), f = BQ('bandpass', 800, 5), wet = G(3), dry = G(0.15), out = G();
    const envA = ctx.createAnalyser(); envA.fftSize = 512;
    const postA = ctx.createAnalyser(); postA.fftSize = 4096; postA.smoothingTimeConstant = 0.82;
    const vis = BQ('bandpass', 800, 5);
    input.connect(f).connect(wet).connect(out);
    input.connect(dry).connect(out);
    input.connect(envA); out.connect(postA);
    const lfo = JSLFO(1.2);
    const tbuf = new Float32Array(envA.fftSize);
    let env = 0;
    const fx = { input, output: out, postA, vis, lfo, params: { mode: 'wah', pos: 0.5, res: 0.45, auto: 'off', rate: 1.2, sens: 0.5 } };
    fx.curPos = 0.5;
    fx.freqFor = (pos) => (fx.params.mode === 'wah' ? 380 * Math.pow(2400 / 380, pos) : 80 * Math.pow(14000 / 80, pos));
    fx.wetGain = () => wet.gain.value;
    fx.dryGain = () => dry.gain.value;
    function setFreq(pos) {
      fx.curPos = pos;
      const fr = fx.freqFor(pos);
      f.frequency.setTargetAtTime(fr, ctx.currentTime, 0.012);
      vis.frequency.value = fr;
    }
    fx.apply = (k) => {
      const p = fx.params;
      if (k === 'mode' || k === 'res') {
        if (p.mode === 'wah') {
          f.type = vis.type = 'bandpass';
          const q = 1.5 + p.res * 11;
          f.Q.value = vis.Q.value = q;
          wet.gain.value = (2.2 + q * 0.28) * 1.25; dry.gain.value = 0.12;
        } else {
          f.type = vis.type = p.mode;
          const q = -2 + p.res * 22; // dB for lowpass/highpass
          f.Q.value = vis.Q.value = q;
          wet.gain.value = 1 / Math.max(1, SD.dbToGain(q) * 0.6); dry.gain.value = 0;
        }
        setFreq(fx.curPos);
      }
      if (k === 'pos' && p.auto === 'off') setFreq(p.pos);
      if (k === 'rate') lfo.setRate(p.rate);
      if (k === 'auto' && p.auto === 'off') setFreq(p.pos);
    };
    SD.tickers.add(() => {
      const p = fx.params;
      if (p.auto === 'lfo') setFreq(0.5 + 0.5 * lfo.value());
      else if (p.auto === 'env') {
        envA.getFloatTimeDomainData(tbuf);
        let s = 0; for (let i = 0; i < tbuf.length; i++) s += tbuf[i] * tbuf[i];
        const rms = Math.sqrt(s / tbuf.length);
        env = rms > env ? env + (rms - env) * 0.6 : env * 0.93;
        setFreq(SD.clamp(env * (2 + p.sens * 14), 0, 1));
      }
    });
    return finish(fx, ['mode', 'rate', 'pos']);
  };

  // =============== TREMOLO / VIBRATO ===============
  SD.fx.trem = function () {
    const input = G(), vca = G(1), vib = ctx.createDelay(0.05), tremOut = G(1), vibOut = G(0), out = G(1.2);
    const lfo = LFO(5);
    const lp = BQ('lowpass', 70, 0.6);
    const tDepth = G(0), vDepth = G(0);
    lfo.osc.connect(lp);
    lp.connect(tDepth).connect(vca.gain);
    lp.connect(vDepth).connect(vib.delayTime);
    vib.delayTime.value = 0.012;
    input.connect(vca).connect(tremOut).connect(out);
    input.connect(vib).connect(vibOut).connect(out);
    const fx = { input, output: out, lfo, params: { mode: 'tremolo', rate: 5, depth: 0.7, shape: 'sine' } };
    fx.vibAmt = () => Math.min(0.0105, (fx.params.depth * 0.03) / (2 * Math.PI * fx.params.rate));
    fx.apply = (k) => {
      const p = fx.params;
      if (k === 'mode') { smooth(tremOut.gain, p.mode === 'tremolo' ? 1 : 0, 0.01); smooth(vibOut.gain, p.mode === 'vibrato' ? 1 : 0, 0.01); }
      if (k === 'rate') lfo.setRate(p.rate);
      if (k === 'shape') lfo.setType(p.shape);
      if (k === 'depth' || k === 'rate') {
        smooth(tDepth.gain, p.depth / 2); smooth(vca.gain, 1 - p.depth / 2);
        smooth(vDepth.gain, fx.vibAmt());
      }
    };
    return finish(fx, ['mode', 'rate', 'shape']);
  };

  // =============== CHORUS / FLANGER (stereo modulated delay) ===============
  SD.fx.chorus = function () {
    const input = G(), dL = ctx.createDelay(0.1), dR = ctx.createDelay(0.1);
    const fbL = G(0), fbR = G(0), wetL = G(0.5), wetR = G(0.5), merger = ctx.createChannelMerger(2), dry = G(0.5), out = G(1.5);
    const lfo = LFO(0.8);
    const mL = G(0), mR = G(0);
    lfo.osc.connect(mL).connect(dL.delayTime);
    lfo.osc.connect(mR).connect(dR.delayTime);
    input.connect(dL); input.connect(dR);
    dL.connect(fbL).connect(dL); dR.connect(fbR).connect(dR);
    dL.connect(wetL).connect(merger, 0, 0); dR.connect(wetR).connect(merger, 0, 1);
    merger.connect(out); input.connect(dry).connect(out);
    const fx = { input, output: out, lfo, params: { rate: 0.8, depth: 0.5, delay: 18, feedback: 0, mix: 0.5 } };
    fx.depthSec = () => (fx.params.depth * Math.min(fx.params.delay * 0.9, 7)) / 1000;
    fx.curDelay = (t) => fx.params.delay / 1000 + fx.depthSec() * fx.lfo.value(t);
    fx.wetAmt = () => fx.params.mix * (1 - Math.abs(fx.params.feedback) * 0.45);
    fx.dryAmt = () => 1 - fx.params.mix;
    fx.apply = (k) => {
      const p = fx.params;
      if (k === 'rate') lfo.setRate(p.rate);
      if (k === 'delay' || k === 'depth') {
        smooth(dL.delayTime, p.delay / 1000, 0.05); smooth(dR.delayTime, p.delay / 1000, 0.05);
        const a = fx.depthSec(); smooth(mL.gain, a); smooth(mR.gain, -a);
      }
      if (k === 'feedback') { smooth(fbL.gain, p.feedback); smooth(fbR.gain, p.feedback); }
      if (k === 'feedback' || k === 'mix') {
        smooth(wetL.gain, fx.wetAmt()); smooth(wetR.gain, fx.wetAmt()); smooth(dry.gain, fx.dryAmt());
      }
    };
    return finish(fx, ['rate', 'delay', 'feedback']);
  };

  // =============== PHASER (all-pass chain, JS-driven exponential sweep) ===============
  SD.fx.phaser = function () {
    const input = G(), dry = G(0.62), wet = G(0.62), out = G();
    const aps = Array.from({ length: 8 }, () => BQ('allpass', 700, 0.7));
    const vis = BQ('allpass', 700, 0.7);
    dry.connect(out); wet.connect(out);
    const lfo = JSLFO(0.4);
    const fx = { input, output: out, lfo, vis, params: { rate: 0.4, depth: 0.75, stages: 4, res: 0.25 } };
    fx.freqAt = (t) => 650 * Math.pow(2, fx.params.depth * 2.4 * lfo.value(t));
    fx.curF = 650;
    function wire() {
      input.disconnect();
      aps.forEach((a) => a.disconnect());
      input.connect(dry);
      let prev = input;
      for (let i = 0; i < fx.params.stages / 2; i++) { prev.connect(aps[i]); prev = aps[i]; }
      prev.connect(wet);
    }
    fx.apply = (k) => {
      const p = fx.params;
      if (k === 'stages') wire();
      if (k === 'rate') lfo.setRate(p.rate);
      if (k === 'res') { const q = 0.35 + p.res * 3; aps.forEach((a) => (a.Q.value = q)); vis.Q.value = q; }
    };
    SD.tickers.add(() => {
      const fr = fx.freqAt();
      fx.curF = fr;
      const t = ctx.currentTime;
      for (let i = 0; i < fx.params.stages / 2; i++) aps[i].frequency.setTargetAtTime(fr, t, 0.01);
    });
    return finish(fx, ['stages', 'rate', 'res']);
  };

  // =============== DELAY ===============
  SD.fx.delay = function () {
    const input = G(), d = ctx.createDelay(2), fb = G(0.4), tone = BQ('lowpass', 5000, 0.5), wet = G(0.45), dry = G(1), out = G();
    input.connect(d); d.connect(tone); tone.connect(fb).connect(d); tone.connect(wet).connect(out);
    input.connect(dry).connect(out);
    d.delayTime.value = 0.375;
    const fx = { input, output: out, params: { time: 0.375, feedback: 0.4, mix: 0.45, tone: 0.6 } };
    fx.toneHz = () => 900 * Math.pow(16000 / 900, fx.params.tone);
    fx.apply = (k) => {
      const p = fx.params;
      if (k === 'time') d.delayTime.setTargetAtTime(p.time, ctx.currentTime, 0.07);
      if (k === 'feedback') smooth(fb.gain, p.feedback);
      if (k === 'mix') { smooth(wet.gain, p.mix * 1.1); smooth(dry.gain, 1 - p.mix * 0.35); }
      if (k === 'tone') smooth(tone.frequency, fx.toneHz());
    };
    return finish(fx);
  };

  // =============== REVERB (convolution with a generated impulse response) ===============
  function makeIR(type, decay, damping) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * Math.min(9, decay * 1.1 + 0.08));
    const buf = ctx.createBuffer(2, len, sr);
    const P = {
      room: { er: 8, erSpan: 0.04, build: 0.006, top: 11000 },
      hall: { er: 12, erSpan: 0.09, build: 0.03, top: 9000 },
      plate: { er: 0, erSpan: 0, build: 0.002, top: 16000 },
      spring: { er: 0, erSpan: 0, build: 0.004, top: 4500 },
    }[type];
    let energy = 0;
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      const rnd = SD.rng(7 + ch * 101 + type.length * 13);
      let lp = 0, a = 0;
      const tailAmt = type === 'spring' ? 0.35 : 1;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        if ((i & 63) === 0) {
          const fc = Math.max(350, P.top * Math.pow(1 - 0.88 * damping, (t * 2.2) / decay));
          a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
        }
        lp += a * (rnd() - lp);
        const env = Math.exp((-6.9 * t) / decay) * (1 - Math.exp(-t / P.build));
        data[i] = lp * env * tailAmt;
      }
      for (let k = 0; k < P.er; k++) {
        const tk = P.erSpan * (0.12 + 0.88 * ((k + 0.5 + rnd() * 0.4) / P.er));
        const idx = Math.floor(tk * sr);
        const amp = (0.9 - 0.5 * (tk / P.erSpan)) * (rnd() > 0 ? 1 : -1) * 2.2;
        for (let j = 0; j < 4 && idx + j < len; j++) data[idx + j] += amp * (1 - j / 4);
      }
      if (type === 'spring') {
        // the "drip": dispersive chirps repeating as the wave bounces along the spring
        for (let k = 0; ; k++) {
          const tk = 0.006 + k * 0.031 + rnd() * 0.002;
          if (tk > len / sr - 0.05) break;
          const amp = Math.exp((-6.9 * tk) / decay) * (k % 2 ? -1 : 1) * 0.9;
          const st = Math.floor(tk * sr); let ph = 0;
          for (let j = 0; j < 0.035 * sr && st + j < len; j++) {
            const tt = j / sr;
            ph += (2 * Math.PI * (2600 * Math.exp(-tt / 0.007) + 220)) / sr;
            data[st + j] += amp * Math.sin(ph) * Math.exp(-tt / 0.012);
          }
        }
      }
      for (let i = 0; i < len; i++) energy += data[i] * data[i];
    }
    const g = 1.1 / Math.sqrt(energy / 2);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] *= g; }
    return buf;
  }
  SD.fx.reverb = function () {
    const input = G(), pre = ctx.createDelay(1), conv = ctx.createConvolver(), wet = G(0.4), dry = G(1), out = G();
    conv.normalize = false;
    input.connect(pre).connect(conv).connect(wet).connect(out);
    input.connect(dry).connect(out);
    const fx = { input, output: out, ir: null, params: { type: 'hall', decay: 2.6, predelay: 0.02, damping: 0.4, mix: 0.35 } };
    let timer = null;
    const regen = () => {
      const p = fx.params;
      fx.ir = makeIR(p.type, p.decay, p.damping);
      conv.buffer = fx.ir;
      fx.onIR && fx.onIR();
    };
    fx.apply = (k) => {
      const p = fx.params;
      if (k === 'type' || k === 'decay' || k === 'damping') {
        if (!fx.ir) regen(); else { clearTimeout(timer); timer = setTimeout(regen, 90); }
      }
      if (k === 'predelay') smooth(pre.delayTime, p.predelay);
      if (k === 'mix') { smooth(wet.gain, p.mix * 1.1); smooth(dry.gain, 1 - p.mix * 0.6); }
    };
    return finish(fx, ['type', 'predelay', 'mix']);
  };
})();
