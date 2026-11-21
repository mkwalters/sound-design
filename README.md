# Stompbox School

A ~15-minute interactive lesson on guitar effects, one page per chapter (Next/Back, ←/→ keys,
thin progress bar on top): overdrive/distortion/fuzz, compression, filters & wah,
tremolo/vibrato, chorus/flanger, phaser, delay and reverb, ending with a reorderable
pedalboard, a "name that pedal" ear-training quiz and a cheat sheet. Hover any knob for a
one-line explanation.

Every sound is synthesized live with the Web Audio API. Demos default to simple synth tones
(pure, buzzy, blip, loud & soft) because they make each effect easy to hear; guitar riffs
(Karplus-Strong plucked strings) and a drum loop are one click away, so there are no audio assets. You can also load your own audio file
or use a live input (guitar interface or mic).

## Run it

No build step. Open `index.html` directly, or serve the folder:

    python3 -m http.server 8000   # then visit http://localhost:8000

(Live input needs `localhost` or https.)

## Layout

- `js/audio.js` – AudioContext, master bus + limiter, synthesized sources, global player
- `js/effects.js` – effect factories (each with a bypass footswitch wrapper)
- `js/ui.js` – knobs, pedals, segmented controls, canvases, transport, frame loop
- `js/ch-*.js` – one file per chapter (controls + visualizations)
- `js/main.js` – pager (hash routing), progress bar, bottom dock
