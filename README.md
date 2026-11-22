# Stompbox School

A ~15-minute interactive lesson on guitar effects, one page per chapter (Next/Back, ←/→ keys,
thin progress bar on top): overdrive/distortion/fuzz, compression, filters & wah,
tremolo/vibrato, chorus/flanger, phaser, delay and reverb, ending with a reorderable
pedalboard, endless "name that pedal" ear training (with per-pedal weak-spot stats) and a cheat sheet. Hover any knob for a
one-line explanation.

Demo audio comes from a small sampler built on real electric-guitar samples
(FreePats "Electric Guitar FSBS Jazz", **CC0**, so commercial use is fine; see
`assets/guitar/LICENSE.txt`). Each effect page defaults to a phrase written to show that
effect off: palm-muted power chords for drive, dynamic fingerpicking for compression,
funk 16ths for wah, ringing chords for tremolo/phaser, arpeggios for chorus, a sparse
melody for delay, chord stabs with space for reverb. Synth tones, a drum loop, your own
audio file, or a live input are also available as sources.

## Run it

No build step, but it must be served (the guitar samples are fetched over HTTP):

    python3 -m http.server 8000   # then visit http://localhost:8000

## Layout

- `js/audio.js` – AudioContext, master bus + limiter, guitar sampler + phrase library, synth sources, global player
- `assets/guitar/` – 35 trimmed CC0 guitar samples (9.5 MB)
- `js/effects.js` – effect factories (each with a bypass footswitch wrapper)
- `js/ui.js` – knobs, pedals, segmented controls, canvases, transport, frame loop
- `js/ch-*.js` – one file per chapter (controls + visualizations)
- `js/main.js` – pager (hash routing), progress bar, bottom dock
