/* Chapter 11: ear training. Endless rounds, with per-pedal stats that surface your weak spots. */
(function () {
  const { h, ctx } = SD;
  const box = document.getElementById('quiz-box');

  const BANK = [
    { id: 'drive', label: 'Distortion / fuzz', color: 'var(--c-drive)', src: 'riff', make: () => { const f = SD.fx.drive(); f.setMany({ mode: 'fuzz', drive: 0.7 }); return f; },
      why: 'Clipped and buzzy. The peaks are flattened.' },
    { id: 'wah', label: 'Wah', color: 'var(--c-filter)', src: 'funk', make: () => { const f = SD.fx.filter(); f.setMany({ auto: 'lfo', rate: 1.6, res: 0.6 }); return f; },
      why: 'A peak sweeping up and down: “wah‑wah”.' },
    { id: 'trem', label: 'Tremolo', color: 'var(--c-trem)', src: 'held', make: () => { const f = SD.fx.trem(); f.setMany({ rate: 6, depth: 0.85 }); return f; },
      why: 'Volume pulses. Pitch stays put.' },
    { id: 'chorus', label: 'Chorus', color: 'var(--c-chorus)', src: 'arp', make: () => { const f = SD.fx.chorus(); f.setMany({ rate: 1.0, depth: 0.7, delay: 20, feedback: 0, mix: 0.5 }); return f; },
      why: 'Gentle shimmer, like two players slightly out of tune.' },
    { id: 'flanger', label: 'Flanger', color: 'var(--c-chorus)', src: 'held', make: () => { const f = SD.fx.chorus(); f.setMany({ rate: 0.2, depth: 0.9, delay: 2.8, feedback: 0.8, mix: 0.5 }); return f; },
      why: 'A metallic jet whoosh from a sliding comb.' },
    { id: 'phaser', label: 'Phaser', color: 'var(--c-phaser)', src: 'arp', make: () => { const f = SD.fx.phaser(); f.setMany({ rate: 0.5, depth: 0.85, stages: 6, res: 0.4 }); return f; },
      why: 'A soft swirl from a few sweeping notches.' },
    { id: 'delay', label: 'Delay', color: 'var(--c-delay)', src: 'sparse', make: () => { const f = SD.fx.delay(); f.setMany({ time: 0.42, feedback: 0.5, mix: 0.55, tone: 0.6 }); return f; },
      why: 'Separate, distinct repeats.' },
    { id: 'reverb', label: 'Reverb', color: 'var(--c-reverb)', src: 'stab', make: () => { const f = SD.fx.reverb(); f.setMany({ type: 'hall', decay: 4, mix: 0.55 }); return f; },
      why: 'A smooth wash with no single echo: a big room.' },
  ];
  const STUDY = { drive: 'drive', wah: 'filter', trem: 'trem', chorus: 'chorus', flanger: 'chorus', phaser: 'phaser', delay: 'delay', reverb: 'reverb' };
  const byId = Object.fromEntries(BANK.map((b) => [b.id, b]));
  const insts = {};
  const getFx = (q) => {
    if (!insts[q.id]) { insts[q.id] = q.make(); insts[q.id].outputNode.connect(SD.master); }
    return insts[q.id];
  };
  const dryIn = ctx.createGain(); dryIn.connect(SD.master);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Per-effect record: { n: times heard, ok: times named right, conf: { guessedId: count } }. Kept in this browser only.
  const KEY = 'sd-ear-stats';
  let stats = {};
  try { stats = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { stats = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch (e) { /* storage blocked: stats last for this visit */ } };
  let session = { n: 0, ok: 0, streak: 0 };
  let last = null, cur = null;

  // Pick the next sound, leaning toward the ones you miss (never the same twice in a row).
  function pick() {
    const pool = BANK.filter((b) => b.id !== last);
    const wt = (b) => { const r = stats[b.id]; return r && r.n ? 1 + 2 * (1 - r.ok / r.n) : 1.5; };
    let x = Math.random() * pool.reduce((a, b) => a + wt(b), 0);
    for (const b of pool) { x -= wt(b); if (x <= 0) return b; }
    return pool[pool.length - 1];
  }

  const ownerM = { label: 'Ear training: mystery pedal' }, ownerD = { label: 'Ear training: dry signal' };

  function playBtn(text, owner, cls, getDest, src) {
    const lbl = h('span', { class: 'play-label' }, text);
    const b = h('button', { type: 'button', class: 'play-btn ' + cls }, h('span', { class: 'play-icon' }), lbl);
    b.addEventListener('click', () => (SD.player.isOwner(owner) ? SD.player.stop() : SD.player.start(owner, src, getDest())));
    const sync = () => { const on = SD.player.isOwner(owner); b.classList.toggle('playing', on); lbl.textContent = on ? 'Stop' : text; };
    SD.player.on(sync);
    return b;
  }

  const cardSlot = h('div');
  const statsBox = h('div', { class: 'quiz-stats', 'aria-live': 'polite' });
  box.append(cardSlot, statsBox);

  function next() {
    const q = pick();
    last = q.id;
    cur = { q, opts: shuffle([q].concat(shuffle(BANK.filter((b) => b.id !== q.id)).slice(0, 3))) };
    renderCard();
  }

  function renderCard() {
    const { q, opts } = cur;
    const fx = getFx(q);
    fx.setOn(true);
    const tally = h('div', { class: 'quiz-tally' },
      h('span', null, h('b', null, String(session.ok)), ` / ${session.n} right`),
      h('span', null, 'streak ', h('b', null, String(session.streak))));
    const fb = h('div', { class: 'quiz-feedback', role: 'status' });
    const optBtns = opts.map((o) => h('button', { type: 'button', class: 'quiz-opt', style: { '--c': o.color } }, h('span', { class: 'sw' }), o.label));
    const card = h('div', { class: 'quiz-card' },
      h('div', { class: 'quiz-top' }, h('span', { class: 'quiz-round' }, 'This session'), tally),
      h('p', { class: 'quiz-q' }, 'Which pedal is this?'),
      h('div', { class: 'quiz-play' },
        playBtn('Play mystery', ownerM, 'sparkle', () => fx.inputNode, q.src),
        playBtn('Hear it dry', ownerD, 'dry', () => dryIn, q.src)),
      h('div', { class: 'quiz-opts' }, optBtns),
      fb);
    optBtns.forEach((b, i) => b.addEventListener('click', () => {
      const guess = opts[i], ok = guess.id === q.id;
      const r = (stats[q.id] = stats[q.id] || { n: 0, ok: 0, conf: {} });
      r.n++; if (ok) r.ok++; else r.conf[guess.id] = (r.conf[guess.id] || 0) + 1;
      save();
      session.n++; if (ok) { session.ok++; session.streak++; } else session.streak = 0;
      optBtns.forEach((bb, j) => { bb.disabled = true; if (opts[j].id === q.id) bb.classList.add('right'); else if (j === i) bb.classList.add('wrong'); });
      const nextBtn = h('button', { type: 'button', class: 'btn quiz-next' }, 'Next sound →');
      nextBtn.addEventListener('click', () => { SD.player.stop(); next(); });
      fb.innerHTML = '';
      fb.append(h('b', null, ok ? 'Yes! ' : `It was ${q.label.toLowerCase()}. `), q.why, h('div', null, nextBtn));
      fb.classList.add('show');
      tally.replaceWith(h('div', { class: 'quiz-tally' },
        h('span', null, h('b', null, String(session.ok)), ` / ${session.n} right`),
        h('span', null, 'streak ', h('b', null, String(session.streak)))));
      renderStats();
      nextBtn.focus({ preventScroll: true });
    }));
    cardSlot.innerHTML = '';
    cardSlot.append(card);
  }

  // Weak spots: every pedal, worst accuracy first; ones not heard yet go last.
  function renderStats() {
    const rows = BANK.map((b) => ({ b, r: stats[b.id] || { n: 0, ok: 0, conf: {} } }));
    const heard = rows.filter((x) => x.r.n);
    statsBox.innerHTML = '';
    statsBox.append(h('h3', null, 'Your weak spots'),
      h('p', { class: 'sub' }, heard.length ? 'Sorted by how often you miss them. Sounds you miss come up more often.' : 'Answer a few and this fills in, worst first.'));
    if (!heard.length) return;
    rows.sort((a, b) => {
      if (!a.r.n || !b.r.n) return (b.r.n ? 1 : 0) - (a.r.n ? 1 : 0);
      return a.r.ok / a.r.n - b.r.ok / b.r.n || (b.r.n - b.r.ok) - (a.r.n - a.r.ok);
    });
    rows.forEach(({ b, r }) => {
      const acc = r.n ? r.ok / r.n : 0, miss = r.n - r.ok;
      const weak = r.n >= 2 && acc < 0.6;
      const conf = Object.entries(r.conf).sort((x, y) => y[1] - x[1]);
      let note = null;
      if (!r.n) note = h('span', { class: 'stat-note' }, 'not heard yet');
      else if (miss) note = h('span', { class: 'stat-note' },
        'mistaken for ', conf.map(([id, c]) => `${byId[id].label.toLowerCase()} ×${c}`).join(', '), ' · ',
        h('a', { href: '#' + STUDY[b.id] }, 'review →'));
      statsBox.append(h('div', { class: 'stat-row' + (weak ? ' weak' : '') },
        h('span', { class: 'stat-name' }, h('span', { class: 'sw', style: { '--c': b.color } }), b.label),
        h('span', { class: 'stat-bar', 'aria-hidden': 'true' }, h('i', { style: { width: Math.round(acc * 100) + '%' } })),
        h('span', { class: 'stat-num' }, r.n ? `${r.ok}/${r.n}` : '–'),
        note));
    });
    const reset = h('button', { type: 'button', class: 'stat-reset' }, 'Reset my stats');
    reset.addEventListener('click', () => { stats = {}; save(); renderStats(); });
    statsBox.append(reset);
  }

  next();
  renderStats();
})();
