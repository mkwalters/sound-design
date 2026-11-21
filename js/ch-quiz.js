/* Chapter 11: Name that pedal. */
(function () {
  const { h, ctx } = SD;
  const box = document.getElementById('quiz-box');

  const BANK = [
    { id: 'drive', label: 'Distortion / fuzz', color: '#ee7b30', src: 'chug', make: () => { const f = SD.fx.drive(); f.setMany({ mode: 'fuzz', drive: 0.7 }); return f; },
      why: 'The wave is being clipped: buzzy, gritty, compressed, with extra harmonics.' },
    { id: 'wah', label: 'Wah', color: '#8e5fc0', src: 'chords', make: () => { const f = SD.fx.filter(); f.setMany({ auto: 'lfo', rate: 1.6, res: 0.6 }); return f; },
      why: 'A resonant peak sweeps up and down, so it sounds like a voice going “wah‑wah”.' },
    { id: 'trem', label: 'Tremolo', color: '#e2a72e', src: 'chords', make: () => { const f = SD.fx.trem(); f.setMany({ rate: 6, depth: 0.85 }); return f; },
      why: 'The volume pulses up and down. The pitch never changes.' },
    { id: 'chorus', label: 'Chorus', color: '#2bb3a3', src: 'lick', make: () => { const f = SD.fx.chorus(); f.setMany({ rate: 1.0, depth: 0.7, delay: 20, feedback: 0, mix: 0.5 }); return f; },
      why: 'A shimmery, slightly detuned “two guitars” sound, with no obvious sweep.' },
    { id: 'flanger', label: 'Flanger', color: '#1d8a7e', src: 'chords', make: () => { const f = SD.fx.chorus(); f.setMany({ rate: 0.2, depth: 0.9, delay: 2.8, feedback: 0.8, mix: 0.5 }); return f; },
      why: 'A metallic, jet‑plane whoosh: a comb filter sliding up and down.' },
    { id: 'phaser', label: 'Phaser', color: '#e85d8e', src: 'chords', make: () => { const f = SD.fx.phaser(); f.setMany({ rate: 0.5, depth: 0.85, stages: 6, res: 0.4 }); return f; },
      why: 'A smooth, vocal swirl from a few sweeping notches. Softer and less metallic than a flanger.' },
    { id: 'delay', label: 'Delay', color: '#4c9a5a', src: 'pluck', make: () => { const f = SD.fx.delay(); f.setMany({ time: 0.42, feedback: 0.5, mix: 0.55, tone: 0.6 }); return f; },
      why: 'You can hear distinct, separate repeats of each note.' },
    { id: 'reverb', label: 'Reverb', color: '#4a5bd4', src: 'pluck', make: () => { const f = SD.fx.reverb(); f.setMany({ type: 'hall', decay: 4, mix: 0.55 }); return f; },
      why: 'A smooth wash where no single echo stands out. It sounds like a big room.' },
  ];
  const ROUNDS = 6;
  const insts = {};
  const getFx = (q) => {
    if (!insts[q.id]) { insts[q.id] = q.make(); insts[q.id].outputNode.connect(SD.master); }
    return insts[q.id];
  };
  const dryIn = ctx.createGain(); dryIn.connect(SD.master);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  let rounds, idx, results;
  const ownerM = { label: 'Quiz: mystery pedal' }, ownerD = { label: 'Quiz: dry signal' };

  function start() {
    rounds = shuffle(BANK).slice(0, ROUNDS).map((q) => ({ q, opts: shuffle([q].concat(shuffle(BANK.filter((b) => b.id !== q.id)).slice(0, 3))) }));
    idx = 0; results = [];
    renderRound();
  }

  function playBtn(text, owner, cls, getDest, src) {
    const lbl = h('span', { class: 'play-label' }, text);
    const b = h('button', { type: 'button', class: 'play-btn ' + cls }, h('span', { class: 'play-icon' }), lbl);
    b.addEventListener('click', () => (SD.player.isOwner(owner) ? SD.player.stop() : SD.player.start(owner, src, getDest())));
    const sync = () => { const on = SD.player.isOwner(owner); b.classList.toggle('playing', on); lbl.textContent = on ? 'Stop' : text; };
    SD.player.on(sync);
    return b;
  }

  function renderRound() {
    const r = rounds[idx];
    const fx = getFx(r.q);
    fx.setOn(true);
    const dots = h('div', { class: 'quiz-dots', 'aria-hidden': 'true' }, rounds.map((_, i) => h('i', { class: i < results.length ? (results[i] ? 'right' : 'wrong') : i === idx ? 'cur' : '' })));
    const fb = h('div', { class: 'quiz-feedback', role: 'status' });
    const optBtns = r.opts.map((o) => h('button', { type: 'button', class: 'quiz-opt', style: { '--c': o.color } }, h('span', { class: 'sw' }), o.label));
    const card = h('div', { class: 'quiz-card' },
      h('div', { class: 'quiz-top' }, h('span', { class: 'quiz-round' }, `Round ${idx + 1} of ${ROUNDS}`), dots),
      h('p', { class: 'quiz-q' }, 'Which pedal is this?'),
      h('div', { class: 'quiz-play' },
        playBtn('Play mystery', ownerM, '', () => fx.inputNode, r.q.src),
        playBtn('Hear it dry', ownerD, 'dry', () => dryIn, r.q.src)),
      h('div', { class: 'quiz-opts' }, optBtns),
      fb);
    optBtns.forEach((b, i) => b.addEventListener('click', () => {
      const ok = r.opts[i].id === r.q.id;
      results.push(ok);
      optBtns.forEach((bb, j) => { bb.disabled = true; if (r.opts[j].id === r.q.id) bb.classList.add('right'); else if (j === i) bb.classList.add('wrong'); });
      const last = idx === ROUNDS - 1;
      const next = h('button', { type: 'button', class: 'btn quiz-next' }, last ? 'See my score →' : 'Next sound →');
      next.addEventListener('click', () => { SD.player.stop(); idx++; last ? renderFinal() : renderRound(); });
      fb.innerHTML = '';
      fb.append(h('b', null, ok ? 'Yes! ' : `It was ${r.q.label.toLowerCase()}. `), r.q.why, h('div', null, next));
      fb.classList.add('show');
      dots.children[idx].className = ok ? 'right' : 'wrong';
      next.focus({ preventScroll: true });
    }));
    box.innerHTML = '';
    box.append(card);
  }

  function renderFinal() {
    const score = results.filter(Boolean).length;
    const msg = score === ROUNDS ? 'Perfect ears. You could run a guitar shop.'
      : score >= 4 ? 'Great listening! You clearly know your pedals.'
      : score >= 2 ? 'Not bad! Modulation pedals fool everyone at first. Try again.'
      : 'Tricky, right? Scroll up, stomp a few pedals on and off, then have another go.';
    const again = h('button', { type: 'button', class: 'btn' }, 'Play again');
    again.addEventListener('click', start);
    box.innerHTML = '';
    box.append(h('div', { class: 'quiz-card quiz-final' },
      h('p', { class: 'quiz-round' }, 'Your score'),
      h('div', { class: 'score' }, `${score}/${ROUNDS}`),
      h('p', { class: 'quiz-q' }, msg), again));
  }

  start();
})();
