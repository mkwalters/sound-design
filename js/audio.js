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


  // ---------- sampled guitar (FreePats "Electric Guitar FSBS Jazz", CC0) ----------
  // Each sample covers a small key zone (from the bank's SFZ map); we pitch-shift within the zone.
  const ZONES = [
    [35, 40, 'E2_s1', 40], [41, 42, 'F2_s1', 41], [43, 46, 'A2_s2', 45], [47, 49, 'C3_s2', 48],
    [50, 51, 'D3_s3', 50], [52, 53, 'E3_s3', 52], [54, 56, 'G3_s4', 55], [57, 59, 'B3_s5', 59],
    [60, 62, 'Cs4_s5', 61], [63, 65, 'E4_s6', 64], [66, 69, 'G4_s6', 67], [70, 71, 'B4_s6', 71],
    [72, 72, 'C5_s6', 72], [73, 79, 'D5_s6', 74],
  ];
  const HAS_SOFT = new Set(['E2_s1', 'F2_s1', 'A2_s2', 'C3_s2', 'D3_s3', 'E3_s3', 'G3_s4', 'B3_s5', 'Cs4_s5', 'E4_s6']);
  // Second takes ("round robin") for the most-repeated notes, so repeats don't sound machine-gunned.
  const HAS_RR2 = new Set(['E2_s1', 'A2_s2', 'C3_s2', 'E3_s3', 'G3_s4', 'B3_s5', 'Cs4_s5', 'E4_s6', 'G3_s4_soft', 'B3_s5_soft', 'E3_s3_soft']);
  let guitarPromise = null;
  const samples = {};
  function loadGuitar() {
    if (!guitarPromise) {
      const names = [];
      ZONES.forEach(([, , n]) => { names.push(n); if (HAS_SOFT.has(n)) names.push(n + '_soft'); });
      HAS_RR2.forEach((n) => names.push(n + '_rr2'));
      // FLAC first (lossless, a third of the size); the identical WAV is the fallback for browsers that can't decode it.
      const load = async (n, ext) => {
        const res = await fetch('assets/guitar/' + n + ext);
        if (!res.ok) throw new Error('missing sample ' + n + ext);
        return ctx.decodeAudioData(await res.arrayBuffer());
      };
      guitarPromise = Promise.all(names.map(async (n) => {
        try { samples[n] = await load(n, '.flac'); } catch (e) { samples[n] = await load(n, '.wav'); }
      }));
      guitarPromise.catch(() => { guitarPromise = null; });
    }
    return guitarPromise;
  }
  SD.loadGuitar = loadGuitar;

  /* Render a phrase (list of events, times in beats) to an AudioBuffer that loops seamlessly:
     ringing tails that spill past the loop end are folded back onto the start. */
  async function renderPhrase(def) {
    await loadGuitar();
    const beat = 60 / def.bpm, loopLen = def.beats * beat, tail = 5;
    const N = Math.ceil(loopLen * sr);
    const oc = new OfflineAudioContext(1, N + Math.ceil(tail * sr), sr);
    // "amp voicing", tuned per phrase: rumble cut, body, low-mid warmth, presence, and a gentle top roll-off
    const v = Object.assign({ hp: 75, body: 1.5, warm: 0, pres: 1.5, lp: 9000 }, def.voice);
    const bq = (type, f, q, gn) => { const b = oc.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (gn != null) b.gain.value = gn; return b; };
    const hp = bq('highpass', v.hp, 0.6);
    const chain = [hp, bq('peaking', 160, 0.8, v.body), bq('peaking', 380, 0.9, v.warm), bq('peaking', 2600, 0.8, v.pres), bq('highshelf', 7500, 0.7, -3), bq('lowpass', v.lp, 0.6)];
    chain.reduce((a, b) => a.connect(b)).connect(oc.destination);
    const rand = rng(def.seed || 7);
    const rrCount = {};
    def.events.forEach((ev) => {
      const notes = ev.n.slice();
      if (ev.up) notes.reverse();
      const gap = ev.gap ?? (notes.length > 1 ? 0.014 : 0);
      notes.forEach((m, k) => {
        const t = ev.t * beat + k * gap + Math.abs(rand()) * 0.004 + 0.005;
        let vel = ev.v * (0.92 + 0.08 * rand());
        if (ev.up && k > 2) vel *= 0.7;
        const z = ZONES.find((zz) => m >= zz[0] && m <= zz[1]) || ZONES[ZONES.length - 1];
        const soft = vel < 0.55 && HAS_SOFT.has(z[2]);
        const key = z[2] + (soft ? '_soft' : '');
        const take = HAS_RR2.has(key) ? (rrCount[key] = (rrCount[key] || 0) + 1) % 2 : 0;
        const src = oc.createBufferSource();
        src.buffer = samples[key + (take ? '_rr2' : '')];
        src.playbackRate.value = Math.pow(2, (m - z[3]) / 12) * (1 + rand() * 0.0012);
        const g = oc.createGain();
        const level = Math.pow(vel, 1.35) * (ev.mute ? 1.4 : 1);
        g.gain.value = level;
        let node = src;
        if (ev.mute) { const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.5; src.connect(lp); node = lp; }
        node.connect(g).connect(hp);
        const end = t + ev.d * beat;
        g.gain.setValueAtTime(level, end);
        g.gain.setTargetAtTime(0, end, ev.mute ? 0.012 : 0.07);
        src.start(t);
        src.stop(end + 0.8);
      });
    });
    const r = (await oc.startRendering()).getChannelData(0);
    const out = ctx.createBuffer(1, N, sr), d = out.getChannelData(0);
    for (let i = 0; i < r.length; i++) d[i % N] += r[i];
    // loudness-normalise (RMS) with a peak ceiling so every phrase sits at a similar level
    let e = 0, pk = 0;
    for (let i = 0; i < N; i++) { e += d[i] * d[i]; pk = Math.max(pk, Math.abs(d[i])); }
    const g = Math.min((def.rms || 0.075) / Math.sqrt(e / N), 0.85 / pk);
    for (let i = 0; i < N; i++) d[i] *= g;
    return out;
  }

  // ---------- phrases, each written to show off particular effects ----------
  const E = (t, n, d, v, o = {}) => Object.assign({ t, n: [].concat(n), d, v }, o);
  const WARM = { body: 0.5, warm: 2.5, pres: -2, lp: 4200 }; // neck‑pickup‑ish voicing for single‑note lines
  const PHRASES = {
    // Drive: palm‑muted chugs plus ringing power chords (clipping, sustain, chord "mush").
    riff: (() => {
      const ev = [], E5 = [40, 47, 52], G5 = [43, 50, 55], A5 = [45, 52, 57], C5 = [48, 55, 60], D5 = [50, 57, 62];
      const chug = (bar, t) => ev.push(E(bar * 4 + t, [40, 47], 0.42, t % 1 ? 0.72 : 0.9, { mute: true, gap: 0.006 }));
      [0, 1, 2, 3].forEach((bar) => {
        [0, 0.5, 1, 1.5].forEach((t) => chug(bar, t));
        if (bar === 0 || bar === 2) { ev.push(E(bar * 4 + 2, G5, 1, 0.95)); ev.push(E(bar * 4 + 3, A5, 1, 0.95)); }
        if (bar === 1) { ev.push(E(bar * 4 + 2, C5, 0.9, 0.95)); ev.push(E(bar * 4 + 3, D5, 1, 0.95)); }
        if (bar === 3) { ev.push(E(bar * 4 + 2, E5, 2, 1)); }
      });
      return { bpm: 104, beats: 16, events: ev, voice: { hp: 90, body: 0, warm: -2.5, pres: 4, lp: 8000 } };
    })(),
    // Compressor: big contrast on purpose. A hard‑picked chord rings out and decays, then whisper‑quiet
    // fingerpicked notes follow; the last bar is one loud note held so you can hear the sustain change.
    dynamic: (() => {
      const ev = [];
      const bars = [[[40, 47, 52, 56], [59, 56, 52, 56]], [[45, 52, 57, 60], [60, 57, 52, 57]], [[48, 55, 60, 64], [64, 60, 55, 60]]];
      bars.forEach(([chord, ghosts], b) => {
        const o = b * 4;
        ev.push(E(o, chord, 2, 1, { gap: 0.012 }));
        ghosts.forEach((m, i) => ev.push(E(o + 2 + i * 0.5, m, 0.5, 0.1 + 0.03 * (i % 2))));
      });
      ev.push(E(12, [50, 62], 4, 1));
      return { bpm: 84, beats: 16, events: ev };
    })(),
    // Wah: 16th‑note funk stabs with muted scratches (the classic wah/auto‑wah groove).
    funk: (() => {
      const ev = [], Em7 = [52, 55, 59, 62], A9 = [52, 55, 59, 61, 64];
      const hits = { 0: 1, 3: 0.75, 6: 0.95, 8: 0.7, 10: 0.85, 11: 0.65, 14: 0.9 };
      const scr = [2, 4, 7, 12, 13, 15];
      [0, 1, 2, 3].forEach((bar) => {
        const ch = bar % 2 ? A9 : Em7;
        for (let s = 0; s < 16; s++) {
          const t = bar * 4 + s / 4;
          if (hits[s]) ev.push(E(t, ch, 0.18, hits[s], { up: s % 2 === 1, gap: 0.008 }));
          else if (scr.includes(s)) ev.push(E(t, ch, 0.08, 0.5, { mute: true, up: s % 2 === 1, gap: 0.005 }));
        }
      });
      return { bpm: 96, beats: 16, events: ev, voice: { pres: 1, lp: 7000 } };
    })(),
    // Tremolo / phaser / flanger: long, ringing chords, so the movement has something to act on.
    held: {
      bpm: 76, beats: 16, events: [
        E(0, [40, 47, 52, 55, 59, 64], 4, 0.85, { gap: 0.03 }),
        E(4, [48, 52, 55, 59, 64], 4, 0.85, { gap: 0.03 }),
        E(8, [43, 47, 50, 55, 59, 67], 4, 0.85, { gap: 0.03 }),
        E(12, [50, 57, 62, 66], 4, 0.85, { gap: 0.03 }),
      ],
    },
    // Chorus: ringing clean arpeggios, the textbook chorus sound.
    arp: (() => {
      const ev = [];
      const bars = [[40, 47, 54, 59, 66, 59, 54, 47], [48, 55, 59, 64, 67, 64, 59, 55], [45, 52, 59, 60, 64, 60, 59, 52], [50, 57, 62, 66, 69, 66, 62, 57]];
      bars.forEach((ns, b) => ns.forEach((m, i) => ev.push(E(b * 4 + i / 2, m, 4 - i / 2 + 0.3, i === 0 ? 0.9 : 0.62 + 0.1 * (i % 2)))));
      return { bpm: 92, beats: 16, events: ev };
    })(),
    // Delay: short notes with plenty of space for the echoes to land in.
    sparse: {
      bpm: 100, beats: 16, events: [
        E(0, 52, 0.35, 0.9), E(0.75, 55, 0.35, 0.8), E(1.5, 57, 0.5, 0.85),
        E(4, 59, 0.35, 0.9), E(4.75, 57, 0.35, 0.75), E(5.5, 55, 0.5, 0.8),
        E(8, 52, 0.35, 0.9), E(8.75, 55, 0.35, 0.8), E(9.5, 62, 0.5, 0.9),
        E(12, 59, 0.35, 0.85), E(12.75, 55, 0.35, 0.75), E(13.5, 52, 0.8, 0.85),
      ], voice: WARM,
    },
    // Reverb: a short chord stab then silence, so the room's tail is exposed.
    stab: {
      bpm: 90, beats: 8, events: [
        E(0, [40, 47, 52, 55, 59, 64], 0.3, 0.95, { gap: 0.012 }),
        E(3, 71, 0.4, 0.85), E(3.5, 67, 0.4, 0.7),
        E(4, [43, 47, 50, 55, 59, 67], 0.3, 0.9, { gap: 0.012 }),
        E(7, 64, 0.5, 0.8),
      ],
    },
    // A single ringing note.
    note: { bpm: 60, beats: 4, events: [E(0, 55, 3.8, 0.95)], voice: WARM },
    // A bluesy lead line.
    lick: (() => {
      const seq = [[64, .5], [67, .5], [69, .5], [71, 1], [69, .5], [67, .5], [64, .5], [62, .5], [64, 1.5], [null, 1], [59, .5], [62, .5],
        [64, .5], [67, .5], [69, .5], [71, .5], [74, 1], [71, .5], [69, .5], [71, .5], [69, .5], [67, 1], [64, 2]];
      const ev = []; let t = 0;
      seq.forEach(([m, d], i) => { if (m) ev.push(E(t, m - 12, d + 0.05, i % 4 === 0 ? 0.95 : 0.8)); t += d; });
      return { bpm: 100, beats: 16, events: ev, voice: WARM };
    })(),
  };

  // ---------- synth tones (clearer than guitar for hearing exactly what an effect does) ----------
  function tone(d, t0, f, vel, tau, len, harm = 7) {
    const st = Math.floor(t0 * sr), n = Math.floor(len * sr);
    for (let i = 0; i < n && st + i < d.length; i++) {
      const t = i / sr;
      const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / tau);
      let s = 0;
      for (let k = 1; k <= harm; k++) s += Math.sin(2 * Math.PI * k * f * t) / k;
      d[st + i] += vel * env * s;
    }
  }
  function buildBlip() {
    return makeBuffer(2.0, (d) => tone(d, 0.02, 330, 1, 0.09, 0.6), { lp: false, peak: 0.6 });
  }
  function buildPulses() {
    const vels = [1, 0.18, 0.55, 0.12, 0.9, 0.3, 0.7, 0.1];
    return makeBuffer(3.2, (d) => vels.forEach((v, i) => tone(d, i * 0.4 + 0.01, 220, v, 0.16, 0.39)), { lp: false, peak: 0.65 });
  }
  const oscSource = (type, freq, level, lp) => (dest) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = level;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.5; o.connect(f).connect(g); }
    else o.connect(g);
    g.connect(dest); o.start();
    return () => { try { o.stop(ctx.currentTime + 0.15); } catch (e) {} };
  };

  // ---------- source registry ----------
  const cache = {};
  const sourceListeners = new Set();
  let userBuffer = null, userName = '';
  SD.sources = {
    riff: { label: 'Power‑chord riff', guitar: true },
    dynamic: { label: 'Fingerpicking', guitar: true },
    funk: { label: 'Funk rhythm', guitar: true },
    held: { label: 'Ringing chords', guitar: true },
    arp: { label: 'Arpeggios', guitar: true },
    sparse: { label: 'Sparse melody', guitar: true },
    stab: { label: 'Chord stabs', guitar: true },
    note: { label: 'Single note', guitar: true },
    lick: { label: 'Lead lick', guitar: true },
    sine: { label: 'Pure tone', synth: true, node: oscSource('sine', 220, 0.17) },
    saw: { label: 'Buzzy tone', synth: true, node: oscSource('sawtooth', 110, 0.24, 4500) },
    blip: { label: 'Blip', synth: true, build: buildBlip },
    pulses: { label: 'Loud & soft', synth: true, build: buildPulses },
    drums: { label: 'Drum loop', synth: true, build: buildDrums },
    user: { label: 'Your audio', icon: 'file', extra: true, available: () => !!userBuffer },
    live: { label: 'Live input', icon: 'plug', extra: true, live: true, available: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) },
  };
  /* Returns a Promise<AudioBuffer> for buffer-based sources (guitar phrases are rendered on demand). */
  SD.ensureBuffer = (id) => {
    if (id === 'user') return Promise.resolve(userBuffer);
    if (!cache[id]) {
      const def = SD.sources[id];
      cache[id] = def.guitar ? renderPhrase(PHRASES[id]) : Promise.resolve(def.build());
      cache[id].catch(() => { delete cache[id]; });
    }
    return cache[id];
  };
  SD.onSources = (fn) => sourceListeners.add(fn);
  SD.loadUserFile = async (file) => {
    const arr = await file.arrayBuffer();
    userBuffer = await ctx.decodeAudioData(arr);
    userName = file.name.replace(/\.[^.]+$/, '');
    SD.sources.user.label = (userName.length > 18 ? userName.slice(0, 17) + '…' : userName);
    sourceListeners.forEach((fn) => fn());
  };
  // Warm the cache in idle time so the first click is instant.
  const warm = ['riff', 'dynamic', 'funk', 'held', 'arp', 'sparse', 'stab', 'note', 'lick', 'blip', 'pulses', 'drums'];
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
  (function next() { const id = warm.shift(); if (!id) return; idle(() => { SD.ensureBuffer(id).catch(() => {}).then(next); }); })();

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
        } else if (SD.sources[src] && SD.sources[src].node) {
          stopper = SD.sources[src].node(fade);
        } else if (src === 'live') {
          const node = await liveNode();
          if (!this.current || this.current.token !== token) { node.disconnect(); return; }
          node.connect(fade);
          stopper = () => node.disconnect();
        } else {
          this.current.loading = true; emit();
          const buffer = await SD.ensureBuffer(src);
          if (!this.current || this.current.token !== token) { fade.disconnect(); return; }
          this.current.loading = false;
          const b = ctx.createBufferSource();
          b.buffer = buffer;
          b.loop = true;
          b.connect(fade);
          b.start();
          stopper = () => { try { b.stop(ctx.currentTime + 0.12); } catch (e) {} };
        }
      } catch (err) {
        this.current = null;
        emit();
        const msg = src === 'live' ? 'Could not open the microphone / audio input.'
          : location.protocol === 'file:' ? 'Guitar samples need a local server: run “python3 -m http.server” in the project folder.'
          : 'Could not start audio.';
        SD.toast && SD.toast(msg);
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
