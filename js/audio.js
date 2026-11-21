/* Audio engine: context, master bus, synthesized sources, and a single global player. */
(function () {
  const SD = (window.SD = window.SD || {});
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = (SD.ctx = new AC({ latencyHint: 'interactive' }));
  const sr = ctx.sampleRate;

  // ---------- master bus (with a safety limiter) ----------
  const master = ctx.createGain();
  master.gain.value = 0.7;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  const post = ctx.createGain();
  post.gain.value = 0.75;
  master.connect(limiter).connect(post).connect(ctx.destination);
  SD.master = master;
  SD.setVolume = (v) => master.gain.setTargetAtTime(v, ctx.currentTime, 0.03);

  // ---------- helpers ----------
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  SD.mtof = mtof;
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return (s / 4294967296) * 2 - 1;
    };
  }
  SD.rng = rng;

  /* Karplus-Strong plucked string with fractional (all-pass) tuning. Adds into `out`. */
  function pluck(out, t0, midi, dur, o = {}) {
    const vel = o.vel ?? 1;
    const t60 = o.t60 ?? 3.5;
    const bright = o.bright ?? 0.6;
    const rand = o.rand || Math.random;
    const f = mtof(midi);
    const P = sr / f;
    const N = Math.floor(P - 0.6);
    const frac = P - 0.5 - N; // all-pass supplies this fractional delay
    const C = (1 - frac) / (1 + frac);
    const d = Math.pow(10, -3 / (t60 * f));
    const start = Math.floor(t0 * sr);
    const len = Math.min(Math.floor(dur * sr), out.length - start);
    if (len <= N + 2) return;
    const buf = new Float32Array(len);
    // excitation: low-passed noise, then pick-position comb
    const a = 0.08 + 0.85 * (1 - bright);
    const exc = new Float32Array(N + 1);
    let lp = 0;
    for (let i = 0; i <= N; i++) { lp += (1 - a) * ((rand() * 2 - 1) - lp); exc[i] = lp; }
    const pp = Math.max(1, Math.floor(N * (o.pick ?? 0.14)));
    for (let i = 0; i <= N; i++) buf[i] = (exc[i] - (i >= pp ? exc[i - pp] : 0)) * vel;
    let apx = 0, apy = 0;
    for (let n = N + 1; n < len; n++) {
      const v = 0.5 * (buf[n - N] + buf[n - N - 1]) * d;
      const y = C * v + apx - C * apy;
      apx = v; apy = y;
      buf[n] = y;
    }
    const rel = Math.min(len, Math.floor((o.release ?? 0.03) * sr));
    for (let i = 0; i < rel; i++) buf[len - 1 - i] *= i / rel;
    for (let i = 0; i < len; i++) out[start + i] += buf[i];
  }

  function strum(out, t, notes, o = {}) {
    const dir = o.dir || 'down';
    const list = notes.map((m, i) => [m, i]).filter((x) => x[0] != null);
    if (dir === 'up') list.reverse();
    const gap = o.gap ?? 0.011;
    list.forEach(([m, string], k) => {
      let vel = (o.vel ?? 1) * (0.85 + 0.15 * Math.random());
      if (dir === 'up' && string < 3) vel *= 0.55;
      pluck(out, t + k * gap + Math.random() * 0.003, m, o.dur ?? 2, {
        vel: vel * 0.55, t60: o.t60 ?? 3, bright: o.bright ?? 0.55, rand: o.rand, release: 0.05,
      });
    });
  }

  function postProcess(data, opts = {}) {
    // DC block + gentle body low-pass + normalize + edge fades
    let x1 = 0, y1 = 0;
    for (let i = 0; i < data.length; i++) { const x = data[i]; const y = x - x1 + 0.996 * y1; x1 = x; y1 = y; data[i] = y; }
    if (opts.lp !== false) {
      const fc = opts.lp || 6500; const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
      let z = 0;
      for (let i = 0; i < data.length; i++) { z += a * (data[i] - z); data[i] = z; }
    }
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    const g = (opts.peak || 0.72) / (peak || 1);
    for (let i = 0; i < data.length; i++) data[i] *= g;
    const fade = Math.floor(0.012 * sr);
    for (let i = 0; i < fade; i++) { data[i] *= i / fade; data[data.length - 1 - i] *= i / fade; }
    return data;
  }

  function makeBuffer(seconds, fill, opts) {
    const len = Math.floor(seconds * sr);
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    fill(data);
    postProcess(data, opts);
    return buf;
  }

  // ---------- the riffs ----------
  const CH = {
    Em: [40, 47, 52, 55, 59, 64],
    C: [null, 48, 52, 55, 60, 64],
    G: [43, 47, 50, 55, 59, 67],
    D: [null, null, 50, 57, 62, 66],
  };

  function buildChords() {
    const bpm = 96, beat = 60 / bpm, bars = ['Em', 'C', 'G', 'D'];
    const pattern = [[0, 'down', 1], [1, 'down', 0.65], [1.5, 'up', 0.55], [2.5, 'up', 0.6], [3, 'down', 0.75], [3.5, 'up', 0.55]];
    const strums = [];
    bars.forEach((c, b) => pattern.forEach(([at, dir, vel]) => strums.push({ t: (b * 4 + at) * beat, dir, vel, notes: CH[c] })));
    const total = bars.length * 4 * beat;
    const rand = rng(11);
    return makeBuffer(total, (d) => {
      strums.forEach((s, i) => {
        const next = i + 1 < strums.length ? strums[i + 1].t : total;
        strum(d, s.t, s.notes, { dir: s.dir, vel: s.vel, dur: next - s.t + 0.06, rand: () => (rand() + 1) / 2 });
      });
    });
  }

  function buildLick() {
    const bpm = 100, beat = 60 / bpm;
    const seq = [
      [64, .5], [67, .5], [69, .5], [71, 1], [69, .5], [67, .5], [64, .5],
      [62, .5], [64, 1.5], [null, 1], [59, .5], [62, .5],
      [64, .5], [67, .5], [69, .5], [71, .5], [74, 1], [71, .5], [69, .5],
      [71, .5], [69, .5], [67, 1], [64, 2],
    ];
    const total = seq.reduce((s, x) => s + x[1], 0) * beat;
    const rand = rng(23);
    return makeBuffer(total, (d) => {
      let t = 0;
      seq.forEach(([m, b], i) => {
        if (m != null) {
          const last = i === seq.length - 1;
          pluck(d, t, m, last ? total - t : b * beat + 0.04, {
            vel: 0.8 + (i % 4 === 0 ? 0.2 : 0) * 1, t60: 2.6, bright: 0.7, pick: 0.2, rand: () => (rand() + 1) / 2,
          });
        }
        t += b * beat;
      });
    });
  }

  function buildChug() {
    const bpm = 112, e = 60 / bpm / 2;
    // each bar: 8 eighths. 'm' = palm-muted E5, chord arrays = open power chord
    const E5 = [40, 47, 52], G5 = [43, 50, 55], A5 = [45, 52, 57], D5 = [38 + 12, 45 + 12], C5 = [48, 55, 60];
    const bars = [
      ['m', 'm', 'm', 'm', 'm', 'm', G5, A5],
      ['m', 'm', 'm', 'm', E5, '-', 'm', 'm'],
      ['m', 'm', 'm', 'm', 'm', 'm', C5, D5],
      ['m', 'm', A5, '-', G5, '-', E5, '-'],
    ];
    const total = bars.length * 8 * e;
    const rand = rng(37);
    const r = () => (rand() + 1) / 2;
    return makeBuffer(total, (d) => {
      bars.forEach((bar, b) => bar.forEach((x, i) => {
        const t = (b * 8 + i) * e;
        if (x === 'm') {
          const acc = i % 4 === 0 ? 1 : 0.72;
          [40, 47].forEach((m, k) => pluck(d, t + k * 0.006, m, e * 0.95, { vel: 0.9 * acc, t60: 0.22, bright: 0.25, rand: r, release: 0.02 }));
        } else if (Array.isArray(x)) {
          let len = 1; while (bar[i + len] === '-') len++;
          x.forEach((m, k) => pluck(d, t + k * 0.008, m, e * len + 0.03, { vel: 0.85, t60: 2.5, bright: 0.55, rand: r }));
        }
      }));
    }, { lp: 5000 });
  }

  function buildPluck() {
    const total = 3.0;
    const rand = rng(5);
    return makeBuffer(total, (d) => {
      pluck(d, 0.02, 64, 2.4, { vel: 1, t60: 1.6, bright: 0.85, pick: 0.18, rand: () => (rand() + 1) / 2, release: 0.4 });
      pluck(d, 0.02, 52, 2.4, { vel: 0.35, t60: 1.6, bright: 0.6, rand: () => (rand() + 1) / 2, release: 0.4 });
    });
  }

  function buildDrums() {
    const bpm = 100, s16 = 60 / bpm / 4, steps = 32, total = steps * s16;
    const rand = rng(99);
    const kick = (d, t, v) => {
      const st = Math.floor(t * sr), len = Math.floor(0.45 * sr);
      let ph = 0;
      for (let i = 0; i < len && st + i < d.length; i++) {
        const tt = i / sr;
        const f = 48 + 110 * Math.exp(-tt / 0.035);
        ph += (2 * Math.PI * f) / sr;
        d[st + i] += v * (Math.sin(ph) * Math.exp(-tt / 0.16) + (i < 90 ? rand() * 0.25 * (1 - i / 90) : 0));
      }
    };
    const snare = (d, t, v) => {
      const st = Math.floor(t * sr), len = Math.floor(0.28 * sr);
      let hp = 0, prev = 0, lp = 0;
      for (let i = 0; i < len && st + i < d.length; i++) {
        const tt = i / sr, n = rand();
        hp = 0.85 * (hp + n - prev); prev = n; lp += 0.5 * (hp - lp);
        const tone = Math.sin(2 * Math.PI * 185 * tt) * Math.exp(-tt / 0.05) * 0.55;
        d[st + i] += v * 0.75 * (tone + lp * Math.exp(-tt / 0.075));
      }
    };
    const hat = (d, t, v, open) => {
      const st = Math.floor(t * sr), len = Math.floor((open ? 0.3 : 0.06) * sr);
      let p1 = 0, h1 = 0, p2 = 0, h2 = 0;
      for (let i = 0; i < len && st + i < d.length; i++) {
        const tt = i / sr, n = rand();
        h1 = 0.7 * (h1 + n - p1); p1 = n; h2 = 0.7 * (h2 + h1 - p2); p2 = h1;
        d[st + i] += v * 0.22 * h2 * Math.exp(-tt / (open ? 0.12 : 0.022));
      }
    };
    const K = { 0: 1, 6: 0.75, 8: 0.95, 10: 0.6, 16: 1, 19: 0.7, 24: 0.95, 27: 0.65 };
    const S = { 4: 1, 12: 1, 20: 1, 28: 1, 7: 0.16, 15: 0.2, 23: 0.16, 25: 0.22, 30: 0.18 };
    return makeBuffer(total, (d) => {
      for (let i = 0; i < steps; i++) {
        const t = i * s16;
        if (K[i]) kick(d, t, K[i]);
        if (S[i]) snare(d, t, S[i]);
        if (i % 2 === 0) hat(d, t, i % 4 === 0 ? 0.7 : 0.42, i === 30);
        else hat(d, t, 0.14, false);
      }
    }, { lp: 12000, peak: 0.8 });
  }

  // ---------- source registry ----------
  const cache = {};
  const sourceListeners = new Set();
  let userBuffer = null, userName = '';
  SD.sources = {
    chords: { label: 'Strummed chords', build: buildChords },
    lick: { label: 'Lead lick', build: buildLick },
    chug: { label: 'Palm‑muted riff', build: buildChug },
    pluck: { label: 'Single note', build: buildPluck },
    drums: { label: 'Drum loop', build: buildDrums },
    user: { label: 'Your audio', extra: true, available: () => !!userBuffer, build: () => userBuffer },
    live: { label: '🎸 Live input', extra: true, live: true, available: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) },
  };
  SD.getBuffer = (id) => {
    if (id === 'user') return userBuffer;
    if (!cache[id]) cache[id] = SD.sources[id].build();
    return cache[id];
  };
  SD.onSources = (fn) => sourceListeners.add(fn);
  SD.loadUserFile = async (file) => {
    const arr = await file.arrayBuffer();
    userBuffer = await ctx.decodeAudioData(arr);
    userName = file.name.replace(/\.[^.]+$/, '');
    SD.sources.user.label = '📁 ' + (userName.length > 18 ? userName.slice(0, 17) + '…' : userName);
    sourceListeners.forEach((fn) => fn());
  };
  // Warm the cache in idle time so the first click is instant.
  const warm = ['chords', 'lick', 'pluck', 'chug', 'drums'];
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  (function next() { const id = warm.shift(); if (!id) return; idle(() => { SD.getBuffer(id); next(); }); })();

  // ---------- live input ----------
  let liveStream = null;
  async function liveNode() {
    if (!liveStream) {
      liveStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    }
    return ctx.createMediaStreamSource(liveStream);
  }

  // ---------- global player: only one thing plays at a time ----------
  const playerListeners = new Set();
  const emit = () => playerListeners.forEach((fn) => fn(SD.player.current));
  SD.player = {
    current: null,
    async start(owner, src, dest) {
      if (ctx.state !== 'running') await ctx.resume();
      this.stop();
      const fade = ctx.createGain();
      fade.gain.value = 0;
      fade.gain.setTargetAtTime(1, ctx.currentTime, 0.008);
      fade.connect(dest);
      let stopper;
      const token = {};
      this.current = { owner, src, token, stop: () => {} };
      try {
        if (typeof src === 'function') {
          stopper = src(fade);
        } else if (src === 'live') {
          const node = await liveNode();
          if (!this.current || this.current.token !== token) { node.disconnect(); return; }
          node.connect(fade);
          stopper = () => node.disconnect();
        } else {
          const b = ctx.createBufferSource();
          b.buffer = SD.getBuffer(src);
          b.loop = true;
          b.connect(fade);
          b.start();
          stopper = () => { try { b.stop(ctx.currentTime + 0.12); } catch (e) {} };
        }
      } catch (err) {
        this.current = null;
        emit();
        SD.toast && SD.toast(src === 'live' ? 'Could not open the microphone / audio input.' : 'Could not start audio.');
        return;
      }
      this.current.stop = () => {
        fade.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
        setTimeout(() => { stopper && stopper(); fade.disconnect(); }, 160);
      };
      emit();
    },
    stop() {
      if (this.current) { const c = this.current; this.current = null; c.stop(); emit(); }
    },
    isOwner(o) { return !!(this.current && this.current.owner === o); },
    on(fn) { playerListeners.add(fn); },
  };
})();
