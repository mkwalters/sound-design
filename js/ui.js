/* UI building blocks: element helper, knobs, segmented controls, pedals, canvases, transports, frame loop. */
(function () {
  const SD = window.SD;

  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) sk.startsWith('--') ? e.style.setProperty(sk, v[sk]) : (e.style[sk] = v[sk]); }
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(c));
    }
    return e;
  }
  SD.h = h;
  SD.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- icons (inline SVG, so they look the same on every platform) ----------
  const NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.6"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.6"/>',
    speaker: '<path d="M4 9.5h3l5-4v13l-5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    plug: '<path d="M9 3v5M15 3v5"/><path d="M7 8h10v3.5a5 5 0 0 1-10 0z"/><path d="M12 16.5V21"/>',
    guitar: '<path d="M14.6 9.4 20 4"/><path d="m18.4 3.4 2.2 2.2"/><path d="M14.9 9.1c1.2 1.2.5 2.6-.7 3.3-1 .6-1.2 1.5-1.2 2.6 0 2.6-2 4.4-4.4 4.4C6 19.4 4 17.4 4 14.8c0-2.4 1.8-4.4 4.4-4.4 1.1 0 2-.2 2.6-1.2.7-1.2 2.1-1.9 3.3-.7z"/><circle cx="9" cy="14.9" r="1.3"/>',
    amp: '<rect x="3" y="5" width="18" height="15" rx="2.5"/><circle cx="12" cy="13.8" r="3.4"/><path d="M6.5 8.2h.01M9.5 8.2h.01"/>',
    file: '<path d="M4 7a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',
  };
  SD.icon = (name, cls) => {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || '';
    return s;
  };
  document.querySelectorAll('[data-ico]').forEach((e) => e.prepend(SD.icon(e.dataset.ico)));
  // ---------- effect glyphs: one small picture per effect (cheat sheet, ear-training feedback) ----------
  const GLYPHS = {
    drive: '<path class="ghost" d="M3.0 14.0 L3.7 12.4 L4.4 10.9 L5.1 9.4 L5.8 8.0 L6.4 6.7 L7.1 5.5 L7.8 4.5 L8.5 3.6 L9.2 2.9 L9.9 2.4 L10.6 2.1 L11.2 2.0 L11.9 2.1 L12.6 2.4 L13.3 2.9 L14.0 3.6 L14.7 4.5 L15.4 5.5 L16.1 6.7 L16.8 8.0 L17.4 9.4 L18.1 10.9 L18.8 12.4 L19.5 14.0 L20.2 15.6 L20.9 17.1 L21.6 18.6 L22.2 20.0 L22.9 21.3 L23.6 22.5 L24.3 23.5 L25.0 24.4 L25.7 25.1 L26.4 25.6 L27.1 25.9 L27.8 26.0 L28.4 25.9 L29.1 25.6 L29.8 25.1 L30.5 24.4 L31.2 23.5 L31.9 22.5 L32.6 21.3 L33.2 20.0 L33.9 18.6 L34.6 17.1 L35.3 15.6 L36.0 14.0 L36.7 12.4 L37.4 10.9 L38.1 9.4 L38.8 8.0 L39.4 6.7 L40.1 5.5 L40.8 4.5 L41.5 3.6 L42.2 2.9 L42.9 2.4 L43.6 2.1 L44.2 2.0 L44.9 2.1 L45.6 2.4 L46.3 2.9 L47.0 3.6 L47.7 4.5 L48.4 5.5 L49.1 6.7 L49.8 8.0 L50.4 9.4 L51.1 10.9 L51.8 12.4 L52.5 14.0 L53.2 15.6 L53.9 17.1 L54.6 18.6 L55.2 20.0 L55.9 21.3 L56.6 22.5 L57.3 23.5 L58.0 24.4 L58.7 25.1 L59.4 25.6 L60.1 25.9 L60.8 26.0 L61.4 25.9 L62.1 25.6 L62.8 25.1 L63.5 24.4 L64.2 23.5 L64.9 22.5 L65.6 21.3 L66.2 20.0 L66.9 18.6 L67.6 17.1 L68.3 15.6 L69.0 14.0"/><path d="M3.0 14.0 L3.7 12.4 L4.4 10.9 L5.1 9.4 L5.8 8.0 L6.4 7.5 L7.1 7.5 L7.8 7.5 L8.5 7.5 L9.2 7.5 L9.9 7.5 L10.6 7.5 L11.2 7.5 L11.9 7.5 L12.6 7.5 L13.3 7.5 L14.0 7.5 L14.7 7.5 L15.4 7.5 L16.1 7.5 L16.8 8.0 L17.4 9.4 L18.1 10.9 L18.8 12.4 L19.5 14.0 L20.2 15.6 L20.9 17.1 L21.6 18.6 L22.2 20.0 L22.9 20.5 L23.6 20.5 L24.3 20.5 L25.0 20.5 L25.7 20.5 L26.4 20.5 L27.1 20.5 L27.8 20.5 L28.4 20.5 L29.1 20.5 L29.8 20.5 L30.5 20.5 L31.2 20.5 L31.9 20.5 L32.6 20.5 L33.2 20.0 L33.9 18.6 L34.6 17.1 L35.3 15.6 L36.0 14.0 L36.7 12.4 L37.4 10.9 L38.1 9.4 L38.8 8.0 L39.4 7.5 L40.1 7.5 L40.8 7.5 L41.5 7.5 L42.2 7.5 L42.9 7.5 L43.6 7.5 L44.2 7.5 L44.9 7.5 L45.6 7.5 L46.3 7.5 L47.0 7.5 L47.7 7.5 L48.4 7.5 L49.1 7.5 L49.8 8.0 L50.4 9.4 L51.1 10.9 L51.8 12.4 L52.5 14.0 L53.2 15.6 L53.9 17.1 L54.6 18.6 L55.2 20.0 L55.9 20.5 L56.6 20.5 L57.3 20.5 L58.0 20.5 L58.7 20.5 L59.4 20.5 L60.1 20.5 L60.8 20.5 L61.4 20.5 L62.1 20.5 L62.8 20.5 L63.5 20.5 L64.2 20.5 L64.9 20.5 L65.6 20.5 L66.2 20.0 L66.9 18.6 L67.6 17.1 L68.3 15.6 L69.0 14.0"/>',
    comp: '<path class="ghost" d="M3 9H69"/><rect class="ghost-fill" x="7" y="3" width="9" height="6" rx="2"/><rect class="ghost-fill" x="55" y="2" width="9" height="7" rx="2"/><rect class="fill" x="7" y="9" width="9" height="16"/><rect class="fill" x="19" y="17" width="9" height="8" rx="2"/><rect class="fill" x="31" y="11" width="9" height="14" rx="2"/><rect class="fill" x="43" y="19" width="9" height="6" rx="2"/><rect class="fill" x="55" y="9" width="9" height="16"/>',
    wah: '<path d="M3 23C22 23 28 21 33 5 38 21 46 23 69 23"/><path class="soft" d="M15 12h9m-3-3 3 3-3 3M51 12h-9m3-3-3 3 3 3"/>',
    trem: '<path class="wash" d="M3.0 2.5 L3.7 2.6 L4.4 2.8 L5.1 3.2 L5.8 3.7 L6.4 4.3 L7.1 5.0 L7.8 5.7 L8.5 6.5 L9.2 7.3 L9.9 8.0 L10.6 8.7 L11.2 9.3 L11.9 9.8 L12.6 10.2 L13.3 10.4 L14.0 10.5 L14.7 10.4 L15.4 10.2 L16.1 9.8 L16.8 9.3 L17.4 8.7 L18.1 8.0 L18.8 7.3 L19.5 6.5 L20.2 5.7 L20.9 5.0 L21.6 4.3 L22.2 3.7 L22.9 3.2 L23.6 2.8 L24.3 2.6 L25.0 2.5 L25.7 2.6 L26.4 2.8 L27.1 3.2 L27.8 3.7 L28.4 4.3 L29.1 5.0 L29.8 5.7 L30.5 6.5 L31.2 7.3 L31.9 8.0 L32.6 8.7 L33.2 9.3 L33.9 9.8 L34.6 10.2 L35.3 10.4 L36.0 10.5 L36.7 10.4 L37.4 10.2 L38.1 9.8 L38.8 9.3 L39.4 8.7 L40.1 8.0 L40.8 7.3 L41.5 6.5 L42.2 5.7 L42.9 5.0 L43.6 4.3 L44.2 3.7 L44.9 3.2 L45.6 2.8 L46.3 2.6 L47.0 2.5 L47.7 2.6 L48.4 2.8 L49.1 3.2 L49.8 3.7 L50.4 4.3 L51.1 5.0 L51.8 5.7 L52.5 6.5 L53.2 7.3 L53.9 8.0 L54.6 8.7 L55.2 9.3 L55.9 9.8 L56.6 10.2 L57.3 10.4 L58.0 10.5 L58.7 10.4 L59.4 10.2 L60.1 9.8 L60.8 9.3 L61.4 8.7 L62.1 8.0 L62.8 7.3 L63.5 6.5 L64.2 5.7 L64.9 5.0 L65.6 4.3 L66.2 3.7 L66.9 3.2 L67.6 2.8 L68.3 2.6 L69.0 2.5 L69.0 25.5 L68.3 25.4 L67.6 25.2 L66.9 24.8 L66.2 24.3 L65.6 23.7 L64.9 23.0 L64.2 22.3 L63.5 21.5 L62.8 20.7 L62.1 20.0 L61.4 19.3 L60.8 18.7 L60.1 18.2 L59.4 17.8 L58.7 17.6 L58.0 17.5 L57.3 17.6 L56.6 17.8 L55.9 18.2 L55.2 18.7 L54.6 19.3 L53.9 20.0 L53.2 20.7 L52.5 21.5 L51.8 22.3 L51.1 23.0 L50.4 23.7 L49.8 24.3 L49.1 24.8 L48.4 25.2 L47.7 25.4 L47.0 25.5 L46.3 25.4 L45.6 25.2 L44.9 24.8 L44.2 24.3 L43.6 23.7 L42.9 23.0 L42.2 22.3 L41.5 21.5 L40.8 20.7 L40.1 20.0 L39.4 19.3 L38.8 18.7 L38.1 18.2 L37.4 17.8 L36.7 17.6 L36.0 17.5 L35.3 17.6 L34.6 17.8 L33.9 18.2 L33.2 18.7 L32.6 19.3 L31.9 20.0 L31.2 20.7 L30.5 21.5 L29.8 22.3 L29.1 23.0 L28.4 23.7 L27.8 24.3 L27.1 24.8 L26.4 25.2 L25.7 25.4 L25.0 25.5 L24.3 25.4 L23.6 25.2 L22.9 24.8 L22.2 24.3 L21.6 23.7 L20.9 23.0 L20.2 22.3 L19.5 21.5 L18.8 20.7 L18.1 20.0 L17.4 19.3 L16.8 18.7 L16.1 18.2 L15.4 17.8 L14.7 17.6 L14.0 17.5 L13.3 17.6 L12.6 17.8 L11.9 18.2 L11.2 18.7 L10.6 19.3 L9.9 20.0 L9.2 20.7 L8.5 21.5 L7.8 22.3 L7.1 23.0 L6.4 23.7 L5.8 24.3 L5.1 24.8 L4.4 25.2 L3.7 25.4 L3.0 25.5Z"/><path d="M3.0 2.5 L3.7 2.6 L4.4 2.8 L5.1 3.2 L5.8 3.7 L6.4 4.3 L7.1 5.0 L7.8 5.7 L8.5 6.5 L9.2 7.3 L9.9 8.0 L10.6 8.7 L11.2 9.3 L11.9 9.8 L12.6 10.2 L13.3 10.4 L14.0 10.5 L14.7 10.4 L15.4 10.2 L16.1 9.8 L16.8 9.3 L17.4 8.7 L18.1 8.0 L18.8 7.3 L19.5 6.5 L20.2 5.7 L20.9 5.0 L21.6 4.3 L22.2 3.7 L22.9 3.2 L23.6 2.8 L24.3 2.6 L25.0 2.5 L25.7 2.6 L26.4 2.8 L27.1 3.2 L27.8 3.7 L28.4 4.3 L29.1 5.0 L29.8 5.7 L30.5 6.5 L31.2 7.3 L31.9 8.0 L32.6 8.7 L33.2 9.3 L33.9 9.8 L34.6 10.2 L35.3 10.4 L36.0 10.5 L36.7 10.4 L37.4 10.2 L38.1 9.8 L38.8 9.3 L39.4 8.7 L40.1 8.0 L40.8 7.3 L41.5 6.5 L42.2 5.7 L42.9 5.0 L43.6 4.3 L44.2 3.7 L44.9 3.2 L45.6 2.8 L46.3 2.6 L47.0 2.5 L47.7 2.6 L48.4 2.8 L49.1 3.2 L49.8 3.7 L50.4 4.3 L51.1 5.0 L51.8 5.7 L52.5 6.5 L53.2 7.3 L53.9 8.0 L54.6 8.7 L55.2 9.3 L55.9 9.8 L56.6 10.2 L57.3 10.4 L58.0 10.5 L58.7 10.4 L59.4 10.2 L60.1 9.8 L60.8 9.3 L61.4 8.7 L62.1 8.0 L62.8 7.3 L63.5 6.5 L64.2 5.7 L64.9 5.0 L65.6 4.3 L66.2 3.7 L66.9 3.2 L67.6 2.8 L68.3 2.6 L69.0 2.5"/><path d="M3.0 25.5 L3.7 25.4 L4.4 25.2 L5.1 24.8 L5.8 24.3 L6.4 23.7 L7.1 23.0 L7.8 22.3 L8.5 21.5 L9.2 20.7 L9.9 20.0 L10.6 19.3 L11.2 18.7 L11.9 18.2 L12.6 17.8 L13.3 17.6 L14.0 17.5 L14.7 17.6 L15.4 17.8 L16.1 18.2 L16.8 18.7 L17.4 19.3 L18.1 20.0 L18.8 20.7 L19.5 21.5 L20.2 22.3 L20.9 23.0 L21.6 23.7 L22.2 24.3 L22.9 24.8 L23.6 25.2 L24.3 25.4 L25.0 25.5 L25.7 25.4 L26.4 25.2 L27.1 24.8 L27.8 24.3 L28.4 23.7 L29.1 23.0 L29.8 22.3 L30.5 21.5 L31.2 20.7 L31.9 20.0 L32.6 19.3 L33.2 18.7 L33.9 18.2 L34.6 17.8 L35.3 17.6 L36.0 17.5 L36.7 17.6 L37.4 17.8 L38.1 18.2 L38.8 18.7 L39.4 19.3 L40.1 20.0 L40.8 20.7 L41.5 21.5 L42.2 22.3 L42.9 23.0 L43.6 23.7 L44.2 24.3 L44.9 24.8 L45.6 25.2 L46.3 25.4 L47.0 25.5 L47.7 25.4 L48.4 25.2 L49.1 24.8 L49.8 24.3 L50.4 23.7 L51.1 23.0 L51.8 22.3 L52.5 21.5 L53.2 20.7 L53.9 20.0 L54.6 19.3 L55.2 18.7 L55.9 18.2 L56.6 17.8 L57.3 17.6 L58.0 17.5 L58.7 17.6 L59.4 17.8 L60.1 18.2 L60.8 18.7 L61.4 19.3 L62.1 20.0 L62.8 20.7 L63.5 21.5 L64.2 22.3 L64.9 23.0 L65.6 23.7 L66.2 24.3 L66.9 24.8 L67.6 25.2 L68.3 25.4 L69.0 25.5"/>',
    chorus: '<path class="soft" d="M3.0 20.3 L3.9 19.3 L4.8 18.2 L5.8 16.9 L6.7 15.6 L7.6 14.2 L8.5 12.7 L9.4 11.3 L10.3 10.0 L11.2 8.8 L12.2 7.7 L13.1 6.9 L14.0 6.3 L14.9 6.0 L15.8 6.1 L16.8 6.4 L17.7 7.1 L18.6 8.1 L19.5 9.4 L20.4 10.9 L21.3 12.6 L22.2 14.5 L23.2 16.3 L24.1 18.0 L25.0 19.5 L25.9 20.7 L26.8 21.6 L27.8 22.0 L28.7 21.9 L29.6 21.3 L30.5 20.2 L31.4 18.7 L32.3 16.9 L33.2 14.9 L34.2 12.8 L35.1 10.8 L36.0 9.0 L36.9 7.6 L37.8 6.6 L38.8 6.1 L39.7 6.1 L40.6 6.6 L41.5 7.7 L42.4 9.1 L43.3 10.9 L44.2 12.8 L45.2 14.7 L46.1 16.7 L47.0 18.4 L47.9 19.8 L48.8 21.0 L49.8 21.7 L50.7 22.0 L51.6 21.9 L52.5 21.4 L53.4 20.6 L54.3 19.5 L55.2 18.2 L56.2 16.7 L57.1 15.1 L58.0 13.5 L58.9 12.0 L59.8 10.6 L60.8 9.3 L61.7 8.2 L62.6 7.3 L63.5 6.6 L64.4 6.2 L65.3 6.0 L66.2 6.1 L67.2 6.4 L68.1 7.0 L69.0 7.7"/><path d="M3.0 14.0 L3.9 12.3 L4.8 10.6 L5.8 9.1 L6.7 7.9 L7.6 6.9 L8.5 6.3 L9.4 6.0 L10.3 6.1 L11.2 6.6 L12.2 7.4 L13.1 8.6 L14.0 10.0 L14.9 11.6 L15.8 13.3 L16.8 15.0 L17.7 16.7 L18.6 18.3 L19.5 19.7 L20.4 20.7 L21.3 21.5 L22.2 21.9 L23.2 22.0 L24.1 21.6 L25.0 20.9 L25.9 19.9 L26.8 18.6 L27.8 17.1 L28.7 15.4 L29.6 13.7 L30.5 11.9 L31.4 10.3 L32.3 8.9 L33.2 7.7 L34.2 6.7 L35.1 6.2 L36.0 6.0 L36.9 6.2 L37.8 6.7 L38.8 7.7 L39.7 8.9 L40.6 10.3 L41.5 11.9 L42.4 13.7 L43.3 15.4 L44.2 17.1 L45.2 18.6 L46.1 19.9 L47.0 20.9 L47.9 21.6 L48.8 22.0 L49.8 21.9 L50.7 21.5 L51.6 20.7 L52.5 19.7 L53.4 18.3 L54.3 16.7 L55.2 15.0 L56.2 13.3 L57.1 11.6 L58.0 10.0 L58.9 8.6 L59.8 7.4 L60.8 6.6 L61.7 6.1 L62.6 6.0 L63.5 6.3 L64.4 6.9 L65.3 7.9 L66.2 9.1 L67.2 10.6 L68.1 12.3 L69.0 14.0"/>',
    phaser: '<path d="M3 7H13C18 7 19 24 22 24S26 7 31 7H41C46 7 47 24 50 24S54 7 59 7H69"/>',
    delay: '<rect class="fill" x="6" y="3" width="7" height="22" rx="2"/><rect class="fill" x="24" y="10" width="7" height="15" rx="2" opacity=".75"/><rect class="fill" x="42" y="16" width="7" height="9" rx="2" opacity=".55"/><rect class="fill" x="60" y="20" width="7" height="5" rx="2" opacity=".4"/>',
    reverb: '<rect class="fill" x="6" y="3" width="5" height="22" rx="2"/><path class="wash" d="M14 25V9C26 13 42 22 69 24.5V25Z"/>',
  };
  GLYPHS.flanger = GLYPHS.chorus; GLYPHS.filter = GLYPHS.wah;
  SD.glyph = (name, color) => {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 72 28');
    s.setAttribute('class', 'glyph');
    s.setAttribute('aria-hidden', 'true');
    if (color) s.style.setProperty('--c', color);
    s.innerHTML = GLYPHS[name] || '';
    return s;
  };
  document.querySelectorAll('[data-glyph]').forEach((e) => e.prepend(SD.glyph(e.dataset.glyph)));
  // Fired (bubbling) whenever a knob, switch or footswitch changes; detail.user = a person did it, not a preset.
  const changed = (el, user) => el.dispatchEvent(new CustomEvent('sd-change', { bubbles: true, detail: { user: !!user } }));

  // ---------- toast ----------
  let toastEl, toastT;
  SD.toast = (msg) => {
    if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status' }); document.body.append(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
  };

  // ---------- tooltips: any element with data-tip (and optional data-tip-title) ----------
  const tipEl = h('div', { class: 'tip', role: 'tooltip', 'aria-hidden': 'true' });
  document.body.append(tipEl);
  let tipTarget = null, tipTimer = 0;
  function placeTip() {
    if (!tipTarget) return;
    const r = tipTarget.getBoundingClientRect();
    const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    const x = SD.clamp(r.left + r.width / 2 - tw / 2, 8, innerWidth - tw - 8);
    let y = r.top - th - 10, below = false;
    if (y < 8) { y = r.bottom + 10; below = true; }
    tipEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    tipEl.classList.toggle('below', below);
    tipEl.style.setProperty('--ax', r.left + r.width / 2 - x + 'px');
  }
  function showTip(el) {
    const text = el.dataset.tip;
    if (!text) return;
    tipTarget = el;
    tipEl.innerHTML = '';
    if (el.dataset.tipTitle) tipEl.append(h('b', null, el.dataset.tipTitle));
    tipEl.append(text);
    tipEl.classList.add('show');
    placeTip();
  }
  function hideTip() { tipEl.classList.remove('show'); tipTarget = null; }
  SD.hideTip = hideTip;
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const t = e.target.closest('[data-tip]');
    if (t && t !== tipTarget) showTip(t);
    else if (!t && tipTarget && !tipTarget.classList.contains('dragging')) hideTip();
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const t = e.target.closest('[data-tip]');
    if (!t) return;
    showTip(t);
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 2400);
  });
  document.addEventListener('focusin', (e) => { const t = e.target.closest('[data-tip]'); if (t && e.target.matches(':focus-visible')) showTip(t); });
  document.addEventListener('focusout', (e) => { if (e.target === tipTarget || (tipTarget && tipTarget.contains(e.target))) hideTip(); });
  addEventListener('scroll', hideTip, { passive: true });
  SD.placeTip = placeTip;

  // ---------- drag + keyboard behaviour shared by knobs and the wah treadle ----------
  function dragControl(target, getN, setN, opts = {}) {
    target.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      target.focus({ preventScroll: true });
      target.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, sn = getN();
      target.classList.add('dragging');
      const move = (ev) => {
        const sens = (ev.shiftKey ? 4 : 1) * (opts.sens || 200);
        const d = opts.vertical ? sy - ev.clientY : ev.clientX - sx + (sy - ev.clientY);
        setN(sn + d / sens);
      };
      const up = (ev) => {
        if (tipTarget === target || (tipTarget && target.contains(tipTarget))) {
          const r = target.getBoundingClientRect();
          if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) hideTip();
        }
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
        target.classList.remove('dragging');
      };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    });
    target.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.1 : 0.02;
      const k = e.key;
      let d = 0;
      if (k === 'ArrowUp' || k === 'ArrowRight') d = step;
      else if (k === 'ArrowDown' || k === 'ArrowLeft') d = -step;
      else if (k === 'PageUp') d = 0.1;
      else if (k === 'PageDown') d = -0.1;
      else if (k === 'Home') { setN(0); e.preventDefault(); return; }
      else if (k === 'End') { setN(1); e.preventDefault(); return; }
      if (d) { setN(getN() + d); e.preventDefault(); }
    });
  }
  SD.dragControl = dragControl;

  // ---------- knob ----------
  SD.knob = function (o) {
    const { min, max } = o;
    const log = o.scale === 'log';
    const toN = (v) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
    const fromN = (n) => {
      let v = log ? min * Math.pow(max / min, n) : min + (max - min) * n;
      if (o.step) v = Math.round(v / o.step) * o.step;
      return v;
    };
    let n = SD.clamp(toN(o.value), 0, 1), value = o.value;
    const def = o.value;
    const dial = h('div', { class: 'knob-dial', role: 'slider', tabindex: 0, 'aria-label': o.label + (o.tip ? '. ' + o.tip : '') });
    const read = h('div', { class: 'knob-value' });
    const el = h('div', { class: 'knob' + (o.small ? ' small' : ''), 'data-tip': o.tip || null, 'data-tip-title': o.tip ? o.label : null, 'data-part': o.part || null },
      dial, h('div', { class: 'knob-label' }, o.label), read);
    const fmt = o.format || ((v) => String(Math.round(v * 100) / 100));
    function render() {
      dial.style.setProperty('--angle', -135 + 270 * n + 'deg');
      const t = fmt(value);
      read.textContent = t;
      dial.setAttribute('aria-valuetext', t);
      dial.setAttribute('aria-valuenow', String(Math.round(n * 100)));
    }
    function setN(nn, silent) {
      n = SD.clamp(nn, 0, 1);
      value = fromN(n);
      render();
      if (!silent && o.onInput) o.onInput(value);
      changed(el, true);
    }
    dial.setAttribute('aria-valuemin', '0');
    dial.setAttribute('aria-valuemax', '100');
    dragControl(dial, () => n, setN);
    dial.addEventListener('dblclick', () => setN(toN(def)));
    render();
    return {
      el,
      get value() { return value; },
      set(v, silent) { n = SD.clamp(toN(v), 0, 1); value = v; render(); if (!silent && o.onInput) o.onInput(v); changed(el); },
    };
  };

  // ---------- segmented control ----------
  SD.segmented = function (o) {
    const el = h('div', { class: 'seg' + (o.small ? ' small' : ''), role: 'radiogroup', 'aria-label': o.label || null, 'data-part': o.part || null });
    let val;
    const btns = o.options.map((op) => {
      const b = h('button', { type: 'button', class: 'seg-btn', role: 'radio', 'data-tip': op.tip || null, 'data-tip-title': op.tip ? op.label : null }, op.label);
      b.addEventListener('click', () => set(op.value, false, true));
      el.append(b);
      return [op.value, b];
    });
    function set(v, silent, user) {
      val = v;
      btns.forEach(([k, b]) => { b.classList.toggle('active', k === v); b.setAttribute('aria-checked', String(k === v)); });
      if (!silent && o.onChange) o.onChange(v);
      changed(el, user);
    }
    set(o.value, true);
    return { el, set, get value() { return val; } };
  };

  // ---------- pedal enclosure ----------
  // Until the first knob is turned anywhere, each pedal shows a small "drag a knob" caption and its first dial wiggles; remembered per viewer.
  const KNOB_KEY = 'sd-knob-learned';
  let knobLearned = false;
  try { knobLearned = localStorage.getItem(KNOB_KEY) === '1'; } catch (e) {}
  const knobHints = [];
  const learnKnobs = (e) => {
    if (knobLearned || !e.target.closest || !e.target.closest('.knob-dial')) return;
    knobLearned = true;
    knobHints.forEach((el) => { el.classList.add('gone'); el.closest('.pedal') && el.closest('.pedal').classList.remove('hinting'); });
    try { localStorage.setItem(KNOB_KEY, '1'); } catch (err) {}
  };
  document.addEventListener('pointerdown', learnKnobs, true);
  document.addEventListener('keydown', learnKnobs, true);
  function knobHint(o) {
    if (knobLearned || o.compact || !(o.knobs && o.knobs.length)) return null;
    const el = h('div', { class: 'knob-hint', 'aria-hidden': 'true' }, h('b', null, '⇕'), ' drag a knob up or down');
    knobHints.push(el);
    return el;
  }

  SD.pedal = function (o) {
    const led = h('span', { class: 'led', 'aria-hidden': 'true' });
    const fs = h('button', { class: 'footswitch', type: 'button', 'aria-pressed': 'true', 'aria-label': `${o.name}: on/off`,
      'data-tip': o.compact ? 'Stomp to switch this pedal on or off.' : 'Stomp to switch the effect off and on, and compare. Shortcut: B.', 'data-tip-title': 'Footswitch' });
    const screws = ['s1', 's2', 's3', 's4'].map((s) => h('span', { class: 'screw ' + s, 'aria-hidden': 'true' }));
    const hintEl = knobHint(o);
    const el = h('div', { class: 'pedal on' + (hintEl ? ' hinting' : '') + (o.compact ? ' compact' : '') + (o.cls ? ' ' + o.cls : ''), style: o.color ? { '--c': o.color } : null },
      screws,
      o.top ? h('div', { class: 'pedal-top' }, o.top) : null,
      o.knobs && o.knobs.length ? h('div', { class: 'pedal-knobs' }, o.knobs.map((k) => k.el || k)) : null,
      hintEl,
      o.middle || null,
      h('div', { class: 'pedal-name' }, h('b', null, o.name), o.sub ? h('small', null, o.sub) : null),
      h('div', { class: 'pedal-row' },
        h('div', { class: 'pedal-foot' }, led, fs, o.compact ? null : h('span', { class: 'fs-hint' }, 'stomp')),
        o.extraFoot || null),
      o.bottom || null);
    let on = true;
    function setOn(v, silent) {
      on = v;
      el.classList.toggle('on', on);
      fs.setAttribute('aria-pressed', String(on));
      if (o.fx) o.fx.setOn(on);
      if (!silent && o.onToggle) o.onToggle(on);
      changed(el, !silent);
    }
    fs.addEventListener('click', () => setOn(!on));
    if (o.startOff) setOn(false, true);
    return { el, led, setOn, toggle: () => setOn(!on), get on() { return on; } };
  };

  // ---------- canvas with DPR-aware resize ----------
  SD.canvas = function (o = {}) {
    const c = h('canvas');
    const box = h('div', { class: 'graph-canvas', style: { height: (o.height || 200) + 'px' } }, c);
    const el = h('figure', { class: 'graph' },
      o.label ? h('figcaption', null, h('span', null, o.label), o.hint ? h('span', { class: 'hint' }, o.hint) : null) : null, box);
    const g = c.getContext('2d');
    const api = { el, canvas: c, g, w: 0, h: 0, draw: null };
    const ro = new ResizeObserver(() => {
      const r = box.getBoundingClientRect();
      if (!r.width) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      api.w = r.width; api.h = r.height;
      if (api.draw) api.draw();
    });
    ro.observe(box);
    return api;
  };

  // ---------- sparkle: a .play-btn.sparkle shimmers until it is first pressed ----------
  document.addEventListener('click', (e) => { const b = e.target.closest('.play-btn.sparkle'); if (b) b.classList.remove('sparkle'); }, true);

  // ---------- frame loop (only runs callbacks for visible elements) ----------
  const recs = [];
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    (en.target.__recs || []).forEach((r) => (r.visible = en.isIntersecting));
  }), { rootMargin: '120px' });
  SD.onFrame = (fn, el) => {
    const rec = { fn, visible: !el };
    recs.push(rec);
    if (el) { el.__recs = (el.__recs || []).concat(rec); io.observe(el); }
  };
  SD.tickers = new Set(); // audio-side tickers that always run (e.g. auto-wah, phaser sweep)
  function loop(t) {
    const s = t / 1000;
    SD.tickers.forEach((fn) => fn(s));
    for (const r of recs) if (r.visible) r.fn(s);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- transport (play button + source chips) ----------
  SD.transport = function (o) {
    const owner = { label: o.label || 'Demo' };
    let src = o.value;
    const label = h('span', { class: 'play-label' }, 'Play');
    const play = h('button', { type: 'button', class: 'play-btn sparkle' }, h('span', { class: 'play-icon', 'aria-hidden': 'true' }), label);
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Sound source' });
    function renderChips() {
      chips.innerHTML = '';
      const ids = o.sources.concat(o.noExtras ? [] : Object.keys(SD.sources).filter((k) => SD.sources[k].extra));
      let prevSynth = null;
      ids.forEach((id) => {
        const def = SD.sources[id];
        if (!def || (def.available && !def.available())) return;
        const isSynth = !!def.synth;
        if (prevSynth !== null && prevSynth !== isSynth) chips.append(h('span', { class: 'chip-sep', 'aria-hidden': 'true' }));
        prevSynth = isSynth;
        const b = h('button', { type: 'button', class: 'chip' + (id === src ? ' active' : '') + (def.live ? ' live' : ''), 'aria-pressed': String(id === src) }, def.icon ? SD.icon(def.icon) : null, def.label);
        b.addEventListener('click', () => {
          src = id;
          renderChips();
          if (def.live) SD.toast('Live input: use headphones to avoid feedback!');
          start();
        });
        chips.append(b);
      });
    }
    function start() { SD.player.start(owner, src, o.dest()); }
    const toggle = () => (SD.player.isOwner(owner) ? SD.player.stop() : start());
    play.addEventListener('click', toggle);
    SD.player.on(() => {
      const on = SD.player.isOwner(owner);
      play.classList.toggle('playing', on);
      label.textContent = on ? (SD.player.current.loading ? 'Loading…' : 'Stop') : 'Play';
    });
    SD.onSources(renderChips);
    renderChips();
    const el = h('div', { class: 'transport' }, play, chips);
    return { el, owner, start, toggle, get source() { return src; }, setSource(id) { src = id; renderChips(); } };
  };

  // ---------- plotting helpers ----------
  const COL = { ink: '#2b2320', ink2: '#5d5049', ink3: '#8b7d70', grid: 'rgba(43,35,32,0.09)', grid2: 'rgba(43,35,32,0.18)', paper: '#fffaf0' };
  SD.COL = COL;
  SD.accentOf = (id) => getComputedStyle(document.getElementById(id)).getPropertyValue('--accent').trim() || '#d1495b';
  SD.alpha = (hex, a) => {
    const m = hex.replace('#', '');
    const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const FREQ_TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  SD.freqLabel = (f) => (f >= 1000 ? (f / 1000) + 'k' : String(f));
  /* Draw a frequency-response frame; returns mapping functions. */
  /* Axis titles: x centred under the plot area, y rotated along the left edge. */
  SD.axisTitles = function (cv, fr, xt, yt) {
    const { g, w, h: H } = cv;
    g.save();
    g.font = '10px "DM Mono", monospace'; g.fillStyle = COL.ink2; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (xt) g.fillText(xt, fr.L + (w - fr.L - fr.R) / 2, H - 3);
    if (yt) { g.translate(10, fr.T + (H - fr.T - fr.B) / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'middle'; g.fillText(yt, 0, 0); }
    g.restore();
  };
  SD.freqFrame = function (cv, o = {}) {
    const { g, w, h: H } = cv;
    const L = 46, R = 8, T = 8, B = 32;
    const fmin = o.fmin || 20, fmax = o.fmax || 20000;
    const dbMin = o.dbMin ?? -30, dbMax = o.dbMax ?? 15;
    const x = (f) => L + (Math.log(f / fmin) / Math.log(fmax / fmin)) * (w - L - R);
    const y = (db) => T + (1 - (db - dbMin) / (dbMax - dbMin)) * (H - T - B);
    g.clearRect(0, 0, w, H);
    g.font = '10.5px "DM Mono", monospace';
    g.lineWidth = 1;
    g.fillStyle = COL.ink3;
    g.textAlign = 'center';
    FREQ_TICKS.forEach((f) => {
      if (f < fmin || f > fmax) return;
      g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(x(f), T); g.lineTo(x(f), H - B); g.stroke();
      g.fillText(SD.freqLabel(f), x(f), H - B + 13);
    });
    g.textAlign = 'right';
    const step = o.dbStep || 10;
    for (let db = Math.ceil(dbMin / step) * step; db <= dbMax; db += step) {
      g.strokeStyle = db === 0 ? COL.grid2 : COL.grid;
      g.beginPath(); g.moveTo(L, y(db)); g.lineTo(w - R, y(db)); g.stroke();
      g.fillText((db > 0 ? '+' : '') + db, L - 5, y(db) + 3.5);
    }
    SD.axisTitles(cv, { L, R, T, B }, 'frequency (Hz) · lows ← → highs', 'level (dB)');
    return { x, y, L, R, T, B, fmin, fmax, dbMin, dbMax };
  };
  SD.logFreqs = (n, fmin = 20, fmax = 20000) => {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = fmin * Math.pow(fmax / fmin, i / (n - 1));
    return a;
  };
  SD.strokePath = (g, pts, color, width = 2.5) => {
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
    g.stroke();
  };
  SD.dbToGain = (db) => Math.pow(10, db / 20);
  SD.gainToDb = (gn) => 20 * Math.log10(Math.max(gn, 1e-6));

  // ---------- signal-path diagram: a little block schematic that mirrors the pedal's knobs ----------
  /* o: { height, on(): bool, draw(d) }. Coordinates are in a 300-wide viewBox. Blocks carry a `part` name;
     knobs/switches with the same `part` light their block up (and the other way round). */
  SD.flow = function (o) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 300 ${o.height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', o.alt || 'Signal path diagram');
    const el = h('figure', { class: 'graph flow' },
      h('figcaption', null, h('span', null, 'Signal path'), h('span', { class: 'hint' }, o.hint || 'what’s inside the box')), svg);
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const pa = (part) => (part ? ` data-part="${part}"` : '');
    let hot = null;
    function setHot(part) {
      hot = part || null;
      svg.querySelectorAll('[data-part]').forEach((n) => n.classList.toggle('hot', n.dataset.part === hot));
    }
    function update() {
      const on = o.on ? o.on() : true;
      let wires = '', nodes = '';
      const d = {
        // polyline of [x, y] points with an arrowhead on the end; ctl = a control signal (dashed, accent), not audio
        wire(pts, opt = {}) {
          const ds = pts.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join('');
          const cls = (opt.ctl ? ' ctl' : '') + (opt.dim ? ' dim' : '');
          wires += `<path class="fw${cls}"${pa(opt.part)} d="${ds}"/>`;
          if (!opt.ctl && !opt.dim) wires += `<path class="fw pulse" d="${ds}"/>`;
          if (opt.arrow === false) return;
          const [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1];
          const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L;
          const bx = x2 - ux * 6.5, by = y2 - uy * 6.5;
          wires += `<path class="fa${cls}"${pa(opt.part)} d="M${x2} ${y2}L${bx - uy * 3.4} ${by + ux * 3.4}L${bx + uy * 3.4} ${by - ux * 3.4}Z"/>`;
        },
        box(cx, cy, w, label, opt = {}) {
          nodes += `<g class="fb${opt.ctl ? ' ctl' : ''}"${pa(opt.part)}><rect x="${cx - w / 2}" y="${cy - 12}" width="${w}" height="24" rx="7"/>` +
            `<text x="${cx}" y="${cy + 3.8}">${esc(label)}</text></g>`;
          if (opt.sub) nodes += `<text class="fs" x="${cx}" y="${cy + 24}" text-anchor="middle">${esc(opt.sub)}</text>`;
        },
        sum(cx, cy, part) {
          nodes += `<g class="fb sum"${pa(part)}><circle cx="${cx}" cy="${cy}" r="8.5"/><path d="M${cx - 4} ${cy}h8M${cx} ${cy - 4}v8"/></g>`;
        },
        dot(cx, cy) { nodes += `<circle class="fd" cx="${cx}" cy="${cy}" r="2.6"/>`; },
        io(x, y, text) { nodes += `<circle class="fd" cx="${x}" cy="${y}" r="3.4"/><text class="fio" x="${x}" y="${y - 9}">${esc(text)}</text>`; },
        note(x, y, text, opt = {}) { nodes += `<text class="fs${opt.ctl ? ' ctl' : ''}" x="${x}" y="${y}" text-anchor="${opt.anchor || 'middle'}">${esc(text)}</text>`; },
      };
      o.draw(d);
      const bypass = on ? '' : `<g class="fbypass"><rect x="62" y="${o.height / 2 - 11}" width="176" height="22" rx="11"/><text x="150" y="${o.height / 2 + 3.5}">bypassed: straight through</text></g>`;
      svg.innerHTML = `<g class="fbody">${wires}${nodes}</g>${bypass}`;
      svg.classList.toggle('off', !on);
      setHot(hot);
    }
    return { el, svg, update, setHot };
  };

  // ---------- preset bar: a labelled row of one-click settings ----------
  /* o: { options: [{ value, label, tip }], apply(value) } */
  SD.presetBar = function (o) {
    const seg = SD.segmented({ label: 'Presets', options: o.options, value: null, onChange: o.apply });
    const el = h('div', { class: 'preset-bar' }, h('span', { class: 'lbl' }, o.label || 'Presets'), seg.el);
    return { el, seg, clear: () => seg.set(null, true) };
  };

  // Per-page actions for the keyboard shortcuts (Space = play/stop, B = bypass); see main.js.
  SD.pageCtl = {};

  /* A bench = transport + pedal (+ signal-path diagram) + graphs, mounted into #bench-<id>. */
  SD.bench = function (id, o) {
    const root = document.getElementById('bench-' + id);
    const tr = SD.transport({ label: o.label, sources: o.sources, value: o.source, dest: o.dest });
    const head = h('div', { class: 'bench-head' }, tr.el, o.presets ? o.presets.el : null, o.headExtra || null);
    const graphs = h('div', { class: 'bench-graphs' + (o.graphLayout ? ' ' + o.graphLayout : '') }, o.graphs.map((gr) => gr.el || gr));
    // The diagram goes under whichever column is shorter, so the page stays compact: the pedal's by default.
    const flow = o.flow, flowRight = flow && o.flowIn === 'graphs';
    if (flowRight) graphs.append(flow.el);
    root.append(head, h('div', { class: 'bench-body' }, h('div', { class: 'bench-pedal' }, o.pedal.el, flow && !flowRight ? flow.el : null), graphs));
    if (flow) {
      // knob <-> block highlighting, in both directions
      const setHot = (part) => {
        flow.setHot(part);
        root.querySelectorAll('.knob[data-part], .seg[data-part]').forEach((k) => k.classList.toggle('hot', !!part && k.dataset.part === part));
      };
      const partOf = (e) => { const t = e.target.closest && e.target.closest('[data-part]'); return t && root.contains(t) ? t.dataset.part : null; };
      root.addEventListener('pointerover', (e) => setHot(partOf(e)));
      root.addEventListener('pointerleave', () => setHot(null));
      root.addEventListener('focusin', (e) => setHot(partOf(e)));
      root.addEventListener('focusout', () => setHot(null));
      SD.player.on(() => flow.el.classList.toggle('playing', SD.player.isOwner(tr.owner)));
      flow.update();
    }
    root.addEventListener('sd-change', (e) => {
      if (flow) flow.update();
      // a hand-turned knob means the settings no longer match the highlighted preset
      if (o.presets && e.detail.user && !o.presets.el.contains(e.target) && !e.target.classList.contains('pedal')) o.presets.clear();
    });
    SD.pageCtl[id] = { play: tr.toggle, bypass: o.pedal.toggle };
    return { root, transport: tr };
  };
})();
