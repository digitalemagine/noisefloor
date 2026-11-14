// noisefloor site: demo, playground and page behaviour. Runs after noisefloor.iife.js (global Noisefloor).
(function () {
  var Scramble = Noisefloor.Scramble, Glitch = Noisefloor.Glitch, Ambient = Noisefloor.Ambient;

  // ------------------------------------------------------------ sample images
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function drone(x, cx, cy, s, fill) {
    x.save();
    x.translate(cx, cy);
    x.fillStyle = fill;
    x.strokeStyle = fill;
    x.lineWidth = s * 0.09;
    x.beginPath(); x.moveTo(-s, -s * 0.55); x.lineTo(s, s * 0.55); x.moveTo(s, -s * 0.55); x.lineTo(-s, s * 0.55); x.stroke();
    x.fillRect(-s * 0.32, -s * 0.2, s * 0.64, s * 0.4);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) {
      x.beginPath(); x.ellipse(p[0] * s, p[1] * s * 0.55, s * 0.5, s * 0.1, 0, 0, Math.PI * 2); x.fill();
    });
    x.restore();
  }
  function hud(x, bx, by, bw, bh, color, label, W) {
    x.strokeStyle = color; x.fillStyle = color; x.lineWidth = Math.max(1.5, W / 700);
    var c = bw * 0.22;
    [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]].forEach(function (p) {
      x.beginPath(); x.moveTo(p[0] + c * p[2], p[1]); x.lineTo(p[0], p[1]); x.lineTo(p[0], p[1] + c * p[3]); x.stroke();
    });
    x.font = '500 ' + Math.round(W / 70) + 'px "JetBrains Mono", monospace';
    x.fillText(label, bx, by - W / 110);
  }
  function makeCity(W, H) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d'), r = rng(7);
    var g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05030e'); g.addColorStop(0.55, '#1b0a3c'); g.addColorStop(0.8, '#4a0f55'); g.addColorStop(1, '#12051f');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    var sg = x.createRadialGradient(W * 0.3, H * 0.72, 0, W * 0.3, H * 0.72, W * 0.45);
    sg.addColorStop(0, 'rgba(255,90,170,.55)'); sg.addColorStop(1, 'rgba(255,90,170,0)');
    x.fillStyle = sg; x.fillRect(0, 0, W, H);
    for (var s = 0; s < 140; s++) { x.fillStyle = 'rgba(220,230,255,' + (0.2 + r() * 0.6) + ')'; x.fillRect(r() * W, r() * H * 0.5, 1.5, 1.5); }
    /** @type {Array<[number, string, number]>} */
    var layers = [[0.52, '#1a0e33', 0.25], [0.6, '#0f0922', 0.45], [0.7, '#07050f', 0.7]];
    layers.forEach(function (L, li) {
      var xx = -20;
      while (xx < W) {
        var bw = W * (0.03 + r() * 0.06), bh = H * (0.12 + r() * 0.35) * (1 + li * 0.2), top = H * L[0] + H * 0.35 - bh;
        x.fillStyle = L[1]; x.fillRect(xx, top, bw, H - top);
        if (r() < 0.3) { x.fillRect(xx + bw * 0.45, top - H * 0.05, 2, H * 0.05); }
        for (var wy = top + 8; wy < H - 6; wy += 9) for (var wx = xx + 5; wx < xx + bw - 5; wx += 8) {
          if (r() < L[2] * 0.22) { x.fillStyle = r() < 0.6 ? 'rgba(0,220,255,.55)' : 'rgba(255,190,90,.6)'; x.fillRect(wx, wy, 3, 4); }
        }
        if (li === 2 && r() < 0.28) {
          x.save(); var nc = r() < 0.5 ? '#ff2bd6' : '#00f0ff';
          x.shadowColor = nc; x.shadowBlur = 18; x.fillStyle = nc;
          x.fillRect(xx + bw * 0.2, top + H * 0.04, bw * 0.12, H * 0.09); x.restore();
        }
        x.fillStyle = L[1];
        xx += bw + W * 0.004;
      }
    });
    var hz = x.createLinearGradient(0, H * 0.75, 0, H);
    hz.addColorStop(0, 'rgba(255,43,214,0)'); hz.addColorStop(1, 'rgba(60,10,70,.55)');
    x.fillStyle = hz; x.fillRect(0, H * 0.75, W, H * 0.25);
    x.strokeStyle = 'rgba(160,190,255,.08)'; x.lineWidth = 1;
    for (var k = 0; k < 220; k++) { var rx = r() * W, ry = r() * H; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx - 6, ry + 26); x.stroke(); }
    var dx = W * 0.72, dy = H * 0.24, ds = W * 0.028;
    drone(x, dx, dy, ds, '#020106');
    x.save(); x.shadowColor = '#ff2a3d'; x.shadowBlur = 12; x.fillStyle = '#ff2a3d';
    x.beginPath(); x.arc(dx, dy + ds * 0.25, 3, 0, Math.PI * 2); x.fill(); x.restore();
    hud(x, dx - ds * 2.2, dy - ds * 1.6, ds * 4.4, ds * 3.2, '#00f0ff', 'TRK 07  1.24 km  ALT 112 m', W);
    return c.toDataURL('image/jpeg', 0.9);
  }
  var CITY = makeCity(1600, 900);
  var imgMain = /** @type {HTMLImageElement} */ (document.getElementById('img-main'));
  imgMain.src = CITY;

  // ------------------------------------------------------------ syntax highlighting
  // Minimal tokenizer for the page's own snippets (JS/TS, HTML, shell): comments,
  // strings, whole HTML tags (attribute values as strings), keywords, numbers.
  // Strings stay on one line (except template literals) so a stray quote cannot
  // colour the rest of a block. An opening tag must not follow a word character,
  // so TypeScript generics such as Array<string> are left alone.
  var HL = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|((?<![\w$])<[a-z][\w-]*(?:\s[^<>]*)?\/?>|<\/[a-z][\w-]*\s*>)|\b(const|let|var|new|function|return|if|else|for|of|in|while|import|from|export|class|extends|implements|interface|type|readonly|private|static|this|typeof|instanceof|null|undefined|true|false|void|declare|try|catch|throw|break|continue)\b(?![=-])|\b(\d+(?:\.\d+)?)\b/g;
  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function span(k, t) { return '<span class="tk-' + k + '">' + esc(t) + '</span>'; }
  function tag(t) {
    var m = /^(<\/?[\w-]+)([\s\S]*?)(\/?>)$/.exec(t);
    var attrs = m[2].split(/("[^"]*"|'[^']*')/).map(function (p, i) { return i % 2 ? span('s', p) : esc(p); }).join('');
    return span('t', m[1]) + attrs + span('t', m[3]);
  }
  function hl(code) {
    var out = '', last = 0, m;
    HL.lastIndex = 0;
    while ((m = HL.exec(code))) {
      out += esc(code.slice(last, m.index)) + (m[3] ? tag(m[0]) : span(m[1] ? 'c' : m[2] ? 's' : m[4] ? 'k' : 'n', m[0]));
      last = HL.lastIndex;
    }
    return out + esc(code.slice(last));
  }
  Array.prototype.forEach.call(document.querySelectorAll('pre:not(#snippet)'), function (p) { p.innerHTML = hl(p.textContent); });

  // ------------------------------------------------------------ configuration
  var PALETTES = {
    'Neon':      ['#ff2bd6', '#00f0ff', '#f5ff3b'],
    'Synth':     ['#f72585', '#4cc9f0', '#7b2ff7'],
    'Amber CRT': ['#ffb000', '#ff5f1f', '#ffe08a'],
    'Phosphor':  ['#39ff88', '#00d0ff', '#c6ff3b'],
    'Ice':       ['#a5f3fc', '#6d8bff', '#f0f4ff'],
    'Redline':   ['#ff2a3d', '#ff9a1f', '#ffffff']
  };
  var GLYPHS = {
    'Signal':   '01#%=$>≤<',
    'Katakana': 'アイウエオカキクケコサシスセソタチツテトナニヌネ',
    'Blocks':   '█▓▒░▌▐▀▄■□',
    'Hex':      '0123456789ABCDEF',
    'Box':      '─│┌┐└┘├┤┬┴┼╳'
  };
  var FONTS = { display: 'var(--display)', mono: 'var(--mono)', system: 'system-ui, sans-serif' };

  var palette = PALETTES['Neon'].slice();
  /** @type {ScrambleOptions} */
  var textOpts = Object.assign({}, Scramble.defaults, { palette: palette });
  /** @type {GlitchOptions} */
  var imgOpts = Object.assign({}, Glitch.defaults, { palette: palette });
  /** @type {AmbientOptions} */
  var ambOpts = Object.assign({}, Ambient.defaults, { rate: 30, amount: 0.25 });
  var state = { trigger: 'mouseenter', scope: 'nav', palette: 'Neon' };

  // ------------------------------------------------------------ instances
  /** @type {SiteText[]} */
  var texts = Array.from(/** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-ss]')), function (el) {
    var inst = /** @type {SiteText} */ (new Scramble(el, textOpts));
    inst.group = el.getAttribute('data-group') || 'title';
    return inst;
  });
  /** @type {GlitchInstance[]} */
  var images = Array.from(/** @type {NodeListOf<HTMLImageElement>} */ (document.querySelectorAll('img.glitch')), function (img) {
    return new Glitch(img, imgOpts);
  });
  function textsIn(g) { return texts.filter(function (t) { return t.group === g; }); }
  var nav = textsIn('nav');
  var title = texts.filter(function (t) { return t.group === 'title'; })[0];
  var heroText = texts.filter(function (t) { return t.el.closest('#hero'); })[0];
  var pvText = textsIn('preview')[0];
  var pvImg = images.filter(function (g) { return g.img.id === 'img-preview'; })[0];
  var site = /** @type {HTMLElement} */ (document.querySelector('.site'));
  var subnav = /** @type {HTMLElement} */ (document.querySelector('.subnav'));
  function subH() { return getComputedStyle(subnav).position === 'sticky' ? subnav.offsetHeight : 0; }
  function siteHeight() {
    document.documentElement.style.setProperty('--site-h', site.offsetHeight + 'px');
    document.documentElement.style.setProperty('--sub-h', subH() + 'px');
  }
  siteHeight();
  window.addEventListener('resize', siteHeight);

  // menu: mark the link of the section in view (the last one whose top has passed
  // a line a third of the way down the viewport; the last one at the bottom of the page)
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.menu .navlink'));
  var navSections = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var apiLinks = Array.prototype.slice.call(subnav.querySelectorAll('a'));
  var apiBlocks = apiLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var navRaf = 0;
  function markSection() {
    navRaf = 0;
    var line = site.offsetHeight + innerHeight / 3, cur = -1;
    navSections.forEach(function (sec, i) { if (sec.getBoundingClientRect().top <= line) cur = i; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) cur = navSections.length - 1;
    navLinks.forEach(function (a, i) { if (i === cur) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    // API sub-menu: the entry whose heading is stuck (or about to be) under the sub-menu
    var stuck = site.offsetHeight + subH() + 40, sub = -1;
    apiBlocks.forEach(function (b, i) { var r = b.getBoundingClientRect(); if (r.top <= stuck && r.bottom > stuck) sub = i; });
    apiLinks.forEach(function (a, i) { if (i === sub) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  }
  function queueMark() { if (!navRaf) navRaf = requestAnimationFrame(markSection); }
  window.addEventListener('scroll', queueMark, { passive: true });
  window.addEventListener('resize', queueMark);
  markSection();

  nav.forEach(function (inst) {
    var link = inst.el.closest('.navlink');
    link.addEventListener('mouseenter', function () { if (state.trigger === 'mouseenter') inst.play(); });
    link.addEventListener('focus', function () { inst.play(); });
    link.addEventListener('click', function () { if (state.trigger === 'click') inst.play(); });
  });
  // typed status line under the headline: types a new message every few seconds while in view
  var typedEl = document.getElementById('typed');
  var typed = new Scramble(typedEl, { reveal: 'type', speed: 24, trail: 0.25, cursor: true, palette: palette });
  var typedMsgs = ['carrier locked', 'decrypting telemetry', 'sync 98.4% / drift 0.2 ms', 'uplink established', 'noise floor -112 dBm'];
  var typedIdx = 0, typedOn = false, typedTimer = 0;
  function typeNext() {
    typedTimer = 0;
    if (!typedOn) return;
    typedIdx = (typedIdx + 1) % typedMsgs.length;
    typed.play({ text: typedMsgs[typedIdx] }).finished.then(function () {
      if (typedOn && !typedTimer) typedTimer = setTimeout(typeNext, 2400);
    });
  }
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    new IntersectionObserver(function (es) {
      typedOn = es[0].isIntersecting;
      if (typedOn && !typedTimer && !typed.running) typedTimer = setTimeout(typeNext, 600);
      if (!typedOn && typedTimer) { clearTimeout(typedTimer); typedTimer = 0; }
    }).observe(document.getElementById('stage'));
  }

  var hero = document.getElementById('hero');
  hero.addEventListener('mouseenter', function () { heroText.play(); });
  hero.addEventListener('click', function () { heroText.play(); });
  document.getElementById('title').addEventListener('click', function () { title.play(); });

  // each image card: glitch the image and scramble its caption together
  images.forEach(function (g) {
    var shot = g.img.closest('.shot');
    if (!shot) return;
    function go(e) {
      if (e && e.type === 'click') e.preventDefault();
      g.play();
      var cap = texts.filter(function (t) { return shot.contains(t.el); })[0]; // looked up each time: the side caption is rebuilt on image swap
      if (cap) cap.play();
    }
    shot.addEventListener('mouseenter', go);
    shot.addEventListener('focus', go);
    shot.addEventListener('click', go);
  });

  var ambient = new Ambient([], ambOpts);
  function ambientTargets() {
    if (state.scope === 'nav') return nav;
    if (state.scope === 'text') return texts;
    return /** @type {Burstable[]} */ (texts).concat(images);
  }
  ambient.setTargets(ambientTargets());

  function applyAll() {
    textOpts.palette = imgOpts.palette = palette;
    texts.forEach(function (t) { t.set(textOpts); });
    images.forEach(function (g) { g.set(imgOpts); });
    typed.set({ palette: palette });
    ambient.set(ambOpts);
    ambient.setTargets(ambientTargets());
    var r = document.documentElement.style;
    r.setProperty('--p1', palette[0]); r.setProperty('--p2', palette[1]); r.setProperty('--p3', palette[2]);
    paintMeter();
    paintSnippet();
  }

  // ------------------------------------------------------------ controls UI
  var root = document.getElementById('controls');
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  // each group folds (<details>); the returned element holds its fields
  function group(name, sub) {
    var d = el('details', { 'class': 'group', open: '' });
    var s = el('summary');
    s.appendChild(el('h3', null, name + (sub ? ' <span>' + sub + '</span>' : '')));
    d.appendChild(s);
    var g = el('div', { 'class': 'group-in' });
    d.appendChild(g);
    root.appendChild(d);
    return g;
  }
  function fmt(v, d) { return Number(v).toFixed(d); }
  function slider(g, target, s, preview) {
    var id = s.id || ('c-' + s.key);
    var show = s.show || function (v) { return fmt(v, s.d) + (s.unit || ''); };
    var f = el('div', { 'class': 'field' });
    f.appendChild(el('label', { 'for': id }, s.label + ' <b id="' + id + '-v">' + show(target[s.key]) + '</b>'));
    var input = el('input', { type: 'range', id: id, min: s.min, max: s.max, step: s.step, value: target[s.key] });
    input.addEventListener('input', function () {
      target[s.key] = parseFloat(input.value);
      document.getElementById(id + '-v').textContent = show(target[s.key]);
      applyAll();
    });
    if (preview) input.addEventListener('change', preview);
    f.appendChild(input);
    g.appendChild(f);
  }
  function check(g, id, label, value, onChange) {
    var lab = el('label', { 'class': 'check', 'for': id });
    var cb = el('input', { type: 'checkbox', id: id });
    cb.checked = value;
    cb.addEventListener('change', function () { onChange(cb.checked); });
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(label));
    g.appendChild(lab);
  }
  function select(g, id, label, options, value, onChange) {
    var f = el('div', { 'class': 'field' });
    f.appendChild(el('label', { 'for': id }, label));
    var s = el('select', { id: id }, options.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === value ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join(''));
    s.addEventListener('change', function () { onChange(s.value); });
    f.appendChild(s);
    g.appendChild(f);
    return s;
  }
  var previewText = function () { pvText.play(); };
  var previewImg = function () { pvImg.play(); };
  document.getElementById('pg-label').addEventListener('click', previewText);
  document.getElementById('pg-shot').addEventListener('click', previewImg);
  document.getElementById('pg-replay').addEventListener('click', function () { previewText(); previewImg(); });

  // text
  var g1 = group('Text', 'timing &middot; all labels');
  slider(g1, textOpts, { key: 'duration', id: 't-duration', label: 'duration', min: 0.15, max: 2.5, step: 0.05, unit: ' s', d: 2 }, previewText);
  slider(g1, textOpts, { key: 'fps', id: 't-fps', label: 'fps (glyph rate)', min: 6, max: 60, step: 1, d: 0 }, previewText);
  slider(g1, textOpts, { key: 'settle', id: 't-settle', label: 'settle (phosphor decay)', min: 0, max: 1.2, step: 0.05, unit: ' s', d: 2 }, previewText);
  select(g1, 't-order', 'lock order', [['ltr', 'left to right'], ['rtl', 'right to left'], ['center', 'centre out'], ['random', 'random']], 'ltr',
    function (v) { textOpts.order = v; applyAll(); previewText(); });
  select(g1, 't-reveal', 'reveal', [['all', 'all at once'], ['type', 'typed']], 'all',
    function (v) { textOpts.reveal = v; applyAll(); previewText(); });
  slider(g1, textOpts, { key: 'trail', id: 't-trail', label: 'trail (typed)', min: 0, max: 0.6, step: 0.01, unit: ' s', d: 2 }, previewText);
  slider(g1, textOpts, { key: 'speed', id: 't-speed', label: 'speed (typed, 0 = fit duration)', min: 0, max: 80, step: 1, unit: ' /s', d: 0 }, previewText);
  check(g1, 't-cursor', 'cursor (typed)', textOpts.cursor, function (v) { textOpts.cursor = v; applyAll(); previewText(); });

  var g2 = group('Text', 'artefacts');
  slider(g2, textOpts, { key: 'jitter', id: 't-jitter', label: 'vertical jitter', min: 0, max: 6, step: 0.1, unit: ' px', d: 1 }, previewText);
  slider(g2, textOpts, { key: 'skew', id: 't-skew', label: 'skew', min: 0, max: 30, step: 1, unit: '°', d: 0 }, previewText);
  slider(g2, textOpts, { key: 'rgbSplit', id: 't-rgb', label: 'RGB split', min: 0, max: 5, step: 0.1, unit: ' px', d: 1 }, previewText);
  slider(g2, textOpts, { key: 'glow', id: 't-glow', label: 'glow', min: 0, max: 20, step: 1, unit: ' px', d: 0 }, previewText);
  slider(g2, textOpts, { key: 'flicker', id: 't-flicker', label: 'flicker', min: 0, max: 0.6, step: 0.01, d: 2 }, previewText);
  slider(g2, textOpts, { key: 'lines', id: 't-lines', label: 'glitch lines', min: 0, max: 8, step: 1, d: 0 }, previewText);
  slider(g2, textOpts, { key: 'tear', id: 't-tear', label: 'sync slip', min: 0, max: 8, step: 0.5, unit: ' px', d: 1 }, previewText);
  check(g2, 't-scan', 'scanlines', textOpts.scanlines, function (v) { textOpts.scanlines = v; applyAll(); previewText(); });

  // glyphs & behaviour
  var g6 = group('Glyphs & behaviour');
  /** @type {HTMLInputElement} */
  var charsInput;
  select(g6, 'c-glyphs', 'glyph set', Object.keys(GLYPHS).map(function (k) { return [k, k]; }).concat([['custom', 'custom']]), 'Signal', function (v) {
    if (v !== 'custom') { textOpts.chars = GLYPHS[v]; charsInput.value = textOpts.chars; applyAll(); previewText(); }
    else charsInput.focus();
  });
  var cf = el('div', { 'class': 'field' });
  cf.appendChild(el('label', { 'for': 'c-chars' }, 'glyphs'));
  charsInput = /** @type {HTMLInputElement} */ (el('input', { type: 'text', id: 'c-chars', spellcheck: 'false', value: textOpts.chars }));
  charsInput.addEventListener('input', function () { textOpts.chars = charsInput.value; /** @type {HTMLSelectElement} */ (document.getElementById('c-glyphs')).value = 'custom'; applyAll(); });
  cf.appendChild(charsInput);
  g6.appendChild(cf);
  select(g6, 'c-font', 'stage typeface', [['display', 'Chakra Petch (proportional)'], ['mono', 'JetBrains Mono'], ['system', 'system sans']], 'display', function (v) {
    document.documentElement.style.setProperty('--stage-font', FONTS[v]);
    previewText();
  });
  select(g6, 'c-trigger', 'nav trigger', [['mouseenter', 'hover'], ['click', 'click']], 'mouseenter', function (v) { state.trigger = v; paintSnippet(); });

  // images
  var g4 = group('Images', 'glitch &middot; all images');
  slider(g4, imgOpts, { key: 'duration', id: 'i-duration', label: 'duration', min: 0.1, max: 2, step: 0.05, unit: ' s', d: 2 }, previewImg);
  slider(g4, imgOpts, { key: 'fps', id: 'i-fps', label: 'fps', min: 6, max: 60, step: 1, d: 0 }, previewImg);
  slider(g4, imgOpts, { key: 'rgbSplit', id: 'i-rgb', label: 'channel split', min: 0, max: 30, step: 0.5, unit: ' px', d: 1 }, previewImg);
  slider(g4, imgOpts, { key: 'slices', id: 'i-slices', label: 'slice tears', min: 0, max: 40, step: 1, d: 0 }, previewImg);
  slider(g4, imgOpts, { key: 'tear', id: 'i-tear', label: 'tear offset', min: 0, max: 120, step: 1, unit: ' px', d: 0 }, previewImg);
  slider(g4, imgOpts, { key: 'blocks', id: 'i-blocks', label: 'block moves', min: 0, max: 30, step: 1, d: 0 }, previewImg);
  slider(g4, imgOpts, { key: 'lines', id: 'i-lines', label: 'colour lines', min: 0, max: 20, step: 1, d: 0 }, previewImg);
  slider(g4, imgOpts, { key: 'jitter', id: 'i-jitter', label: 'frame shake', min: 0, max: 10, step: 0.5, unit: ' px', d: 1 }, previewImg);
  slider(g4, imgOpts, { key: 'flicker', id: 'i-flicker', label: 'flicker', min: 0, max: 0.6, step: 0.01, d: 2 }, previewImg);
  check(g4, 'i-scan', 'scanlines', imgOpts.scanlines, function (v) { imgOpts.scanlines = v; applyAll(); previewImg(); });

  // colour
  var g5 = group('Colour', 'text, images, page');
  var sw = el('div', { 'class': 'swatches', role: 'group', 'aria-label': 'Palette presets' });
  Object.keys(PALETTES).forEach(function (name) {
    var b = el('button', { type: 'button', 'class': 'swatch', 'aria-pressed': String(name === state.palette), 'data-name': name });
    b.innerHTML = '<span class="chips">' + PALETTES[name].map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>' + name;
    b.addEventListener('click', function () { setPalette(PALETTES[name].slice(), name); previewText(); previewImg(); });
    sw.appendChild(b);
  });
  g5.appendChild(sw);
  var pf = el('div', { 'class': 'field' });
  pf.appendChild(el('span', { 'class': 'lbl' }, 'custom &mdash; text RGB split uses 1 + 2'));
  var pickers = el('div', { 'class': 'pickers' });
  var pickEls = [0, 1, 2].map(function (i) {
    var p = el('input', { type: 'color', id: 'c-col' + i, 'aria-label': 'Palette colour ' + (i + 1), value: palette[i] });
    p.addEventListener('input', function () { var pal = palette.slice(); pal[i] = p.value; setPalette(pal, null); });
    p.addEventListener('change', function () { previewText(); previewImg(); });
    pickers.appendChild(p);
    return p;
  });
  pf.appendChild(pickers);
  g5.appendChild(pf);
  // Side illustration follows the palette preset; custom colours keep the current one.
  var SIDE = {
    rooftop: { src: 'media/rooftop.webp', pos: '64% 50%', cap: 'Neon rooftop', alt: 'Anime illustration: a cyborg girl sitting on a steel beam above a neon city' },
    market: { src: 'media/market.webp', pos: '46% 50%', cap: 'Night market', alt: 'Anime illustration: a cyborg girl walking through a rainy night market' },
    station: { src: 'media/station.webp', pos: '66% 50%', cap: 'Rail yard', alt: 'Anime illustration: a cyborg boy leaning on a rusty railing above a rainy train station' }
  };
  var SIDE_FOR = { 'Neon': 'rooftop', 'Synth': 'rooftop', 'Ice': 'station', 'Phosphor': 'station', 'Amber CRT': 'market', 'Redline': 'market' };
  var pvImgEl = /** @type {HTMLImageElement} */ (document.getElementById('img-preview'));
  var sideImg = /** @type {HTMLImageElement} */ (document.getElementById('img-side')), sideCap = texts.filter(function (t) { return t.el.id === 'side-cap'; })[0];
  function setSide(key) {
    var d = SIDE[key];
    if (!d || sideImg.getAttribute('src') === d.src) return;
    sideImg.src = d.src; sideImg.alt = d.alt; sideImg.style.objectPosition = d.pos;
    pvImgEl.src = d.src; pvImgEl.style.objectPosition = d.pos;
    sideCap.play({ text: d.cap });
  }
  function setPalette(pal, name) {
    if (name) setSide(SIDE_FOR[name]);
    palette = pal;
    state.palette = name;
    pickEls.forEach(function (p, i) { p.value = pal[i]; });
    Array.prototype.forEach.call(sw.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-name') === name)); });
    applyAll();
  }

  // micro-glitches
  var g3 = group('Micro-glitches', 'ambient');
  check(g3, 'a-on', 'enabled', ambOpts.enabled, function (v) { ambOpts.enabled = v; applyAll(); });
  select(g3, 'a-scope', 'applies to', [['nav', 'nav labels'], ['text', 'all text'], ['all', 'all text + images']], state.scope,
    function (v) { state.scope = v; applyAll(); });
  slider(g3, ambOpts, { key: 'rate', id: 'a-rate', label: 'frequency', min: 0, max: 240, step: 2,
    show: function (v) { return v ? fmt(v, 0) + ' / min' : 'off'; } });
  slider(g3, ambOpts, { key: 'amount', id: 'a-amount', label: 'amount', min: 0.05, max: 1, step: 0.05,
    show: function (v) { return fmt(v * 100, 0) + '%'; } }, function () { ambient.fire(); });
  slider(g3, ambOpts, { key: 'duration', id: 'a-duration', label: 'burst length', min: 0.04, max: 0.8, step: 0.02, unit: ' s', d: 2 }, function () { ambient.fire(); });
  slider(g3, ambOpts, { key: 'intensity', id: 'a-intensity', label: 'intensity', min: 0.1, max: 1, step: 0.05, d: 2 }, function () { ambient.fire(); });
  var meter = el('div', { 'class': 'meter', id: 'a-meter' });
  g3.appendChild(meter);
  var fireBtn = el('button', { type: 'button', 'class': 'btn', id: 'a-fire' }, 'Fire one now');
  fireBtn.addEventListener('click', function () { ambient.fire(); });
  g3.appendChild(fireBtn);
  function paintMeter() {
    var n = ambientTargets().length;
    meter.innerHTML = ambOpts.enabled && ambOpts.rate
      ? 'each of <b>' + n + '</b> targets glitches about every <b>' + fmt(60 * n / ambOpts.rate, 1) + ' s</b>'
      : 'ambient glitches <b>off</b>';
  }

  // ------------------------------------------------------------ own image
  var fileIn = /** @type {HTMLInputElement} */ (document.getElementById('c-file')), objUrl = null;
  fileIn.addEventListener('change', function () {
    var f = fileIn.files && fileIn.files[0];
    if (!f) return;
    if (objUrl) URL.revokeObjectURL(objUrl);
    objUrl = URL.createObjectURL(f);
    imgMain.addEventListener('load', function once() {
      imgMain.removeEventListener('load', once);
      document.getElementById('main-src').textContent = imgMain.naturalWidth + '×' + imgMain.naturalHeight;
      setTimeout(function () { images[0].play(); }, 60);
    });
    imgMain.alt = f.name;
    imgMain.src = objUrl;
  });
  document.getElementById('c-reset').addEventListener('click', function () {
    imgMain.src = CITY;
    imgMain.alt = 'Night skyline with a drone under track';
    document.getElementById('main-src').textContent = 'sample, 1600×900';
  });

  // ------------------------------------------------------------ snippet
  function obj(o, keys, indent) {
    return '{\n' + keys.map(function (k) {
      return indent + '  ' + (k === 'palette' ? 'palette' : k + ': ' + JSON.stringify(o[k]));
    }).join(',\n') + '\n' + indent + '}';
  }
  var snippet = document.getElementById('snippet');
  function paintSnippet() {
    var tk = ['palette', 'duration', 'fps', 'settle', 'order', 'reveal', 'trail', 'speed', 'cursor', 'chars', 'jitter', 'skew', 'rgbSplit', 'glow', 'flicker', 'lines', 'tear', 'scanlines'];
    var ik = ['palette', 'duration', 'fps', 'rgbSplit', 'slices', 'tear', 'blocks', 'lines', 'jitter', 'flicker', 'scanlines'];
    var ak = ['rate', 'amount', 'duration', 'intensity'];
    var targets = state.scope === 'all' ? '[...labels, ...images]' : 'labels';
    var s =
      '<!-- markup stays plain -->\n' +
      '<nav><a href="#solution"><span class="label">Solution</span></a> …</nav>\n' +
      '<img class="glitch" src="feed.jpg" alt="…">\n\n' +
      '<script src="https://unpkg.com/noisefloor"><\/script>\n' +
      '<script>\n' +
      '  const { Scramble, Glitch, Ambient } = Noisefloor;\n' +
      '  const palette = ' + JSON.stringify(palette).replace(/,/g, ', ') + ';\n\n' +
      '  const labels = Scramble.bind("nav a .label", ' + obj(textOpts, tk, '  ') + ', { trigger: "' + state.trigger + '" });\n\n' +
      '  const images = Glitch.bind("img.glitch", ' + obj(imgOpts, ik, '  ') + ');\n';
    if (ambOpts.enabled && ambOpts.rate > 0) {
      s += '\n  // ambient micro-glitches (rate = per minute, across all targets)\n' +
        '  new Ambient(' + targets + ', ' + obj(ambOpts, ak, '  ') + ');\n';
    }
    s += '<\/script>';
    snippet.innerHTML = hl(s);
  }

  var DESC = {
    text: {
      duration: 'Seconds until the last character locks.', fps: 'Glyph and jitter refresh rate. Lower reads more analog.',
      settle: 'Seconds for colour and position to decay after a character locks.', order: 'Lock order: ltr, rtl, center or random. With typing, also the order characters appear in.',
      reveal: "'all': every character scrambles at once. 'type': characters appear one by one in order, the width reserved from the start.",
      trail: 'Typing: seconds a character scrambles between appearing and locking.', speed: 'Typing: characters per second; when above 0 the run length follows the text and duration is ignored.', cursor: 'Typing: block caret at the typing head. Colour: --nf-cursor.',
      chars: 'Glyphs used while scrambling.', palette: 'Colours for scrambling glyphs and lines; [0] and [1] drive the RGB split.',
      jitter: 'Max vertical offset of a scrambling character, px.', skew: 'Max skew of a scrambling character, degrees.',
      rgbSplit: 'Chromatic aberration, px.', glow: 'Bloom on scrambling characters, px.',
      flicker: 'Chance (0-1) a scrambling character dims on a frame.', lines: 'Glitch lines drawn over the label (0-8).',
      tear: 'Horizontal sync slip of the whole label, px.', scanlines: 'Rolling scanline overlay while live.'
    },
    img: {
      duration: 'Seconds per full glitch.', fps: 'Frame refresh rate.', palette: 'Colours for lines and tinted bands.',
      rgbSplit: 'Max R/B channel offset, px.', slices: 'Horizontal bands displaced per frame at full amount.',
      tear: 'Max sideways displacement of a band, px.', blocks: 'Rectangles copied out of place per frame.',
      lines: 'Palette-coloured scan lines per frame.', jitter: 'Vertical shake of the whole frame, px.',
      flicker: 'Chance (0-1) a frame dims.', scanlines: 'Rolling scanline overlay while live.'
    },
    amb: {
      rate: 'Micro-glitches per minute, across all targets.', amount: 'Share (0-1) of each target disturbed.',
      duration: 'Seconds per micro-glitch.', intensity: 'Artefact strength (0-1).', enabled: 'Start scheduling immediately.'
    }
  };
  function optTable(id, defaults, desc) {
    var rows = Object.keys(defaults).map(function (k) {
      var v = JSON.stringify(defaults[k]);
      return '<tr><td>' + k + '</td><td>' + v.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</td><td>' + (desc[k] || '') + '</td></tr>';
    }).join('');
    document.getElementById(id + '-n').textContent = '\u00b7 ' + Object.keys(defaults).length + ', with defaults';
    document.getElementById(id).innerHTML = '<thead><tr><th>option</th><th>default</th><th>meaning</th></tr></thead><tbody>' + rows + '</tbody>';
  }
  optTable('opt-text', Scramble.defaults, DESC.text);
  optTable('opt-img', Glitch.defaults, DESC.img);
  optTable('opt-amb', Ambient.defaults, DESC.amb);

  // ------------------------------------------------------------ playground panel
  // One playground, opened and closed by every [data-pg-toggle] button (intro, demo stage,
  // Playground section). Wide screens: the controls live in a side panel that pushes the page
  // aside, so the demo at the top stays in view. Narrower: they expand in the Playground
  // section, right after the demo, with the sticky preview. Closed by default.
  var tune = document.getElementById('tune'), tuneBody = document.getElementById('tune-body');
  var pgBody = document.getElementById('pg-body'), tuneClose = document.getElementById('tune-close');
  var pgSection = document.getElementById('playground');
  var toggles = /** @type {HTMLButtonElement[]} */ (Array.prototype.slice.call(document.querySelectorAll('[data-pg-toggle]')));
  var groups = /** @type {HTMLDetailsElement[]} */ (Array.prototype.slice.call(root.children));
  var wide = matchMedia('(min-width: 1440px)');
  /** @type {{ open: boolean, groups: boolean[] }} */
  var pgState = { open: false, groups: groups.map(function (_, i) { return i === 0; }) };
  try {
    var saved = JSON.parse(localStorage.getItem('nf-playground') || 'null');
    if (saved && Array.isArray(saved.groups)) pgState = { open: !!saved.open, groups: groups.map(function (_, i) { return !!saved.groups[i]; }) };
  } catch (e) { /* storage unavailable: defaults */ }
  function savePg() { try { localStorage.setItem('nf-playground', JSON.stringify(pgState)); } catch (e) { /* ignore */ } }
  /** Shows the current state in the current layout. */
  function renderPg() {
    var open = pgState.open, side = wide.matches;
    if (side) {
      tuneBody.appendChild(root);
      groups.forEach(function (g, i) { g.open = pgState.groups[i]; });
    } else {
      pgBody.appendChild(root);
      groups.forEach(function (g) { g.open = true; });
    }
    tune.hidden = !(side && open);
    document.body.classList.toggle('tune-open', side && open);
    pgBody.hidden = side || !open;
    toggles.forEach(function (b) {
      b.textContent = open ? 'Close playground' : 'Open playground';
      b.setAttribute('aria-expanded', String(open));
      b.setAttribute('aria-controls', side ? 'tune' : 'pg-body');
    });
  }
  /** Opens or closes from a button; `from` gets focus back when the panel closes. */
  function setPg(open, from) {
    pgState.open = open;
    savePg();
    renderPg();
    if (wide.matches) {
      if (open) tuneClose.focus();
      else if (from) from.focus();
    } else if (open && from && !pgSection.contains(from)) {
      pgSection.scrollIntoView();
    }
  }
  var lastToggle = /** @type {HTMLElement | null} */ (null);
  toggles.forEach(function (b) {
    b.addEventListener('click', function () { lastToggle = b; setPg(!pgState.open, b); });
  });
  tuneClose.addEventListener('click', function () { setPg(false, lastToggle || toggles[0]); });
  tune.addEventListener('keydown', function (e) { if (e.key === 'Escape') setPg(false, lastToggle || toggles[0]); });
  groups.forEach(function (g, i) {
    g.addEventListener('toggle', function () {
      if (!wide.matches) return;
      pgState.groups[i] = g.open;
      savePg();
    });
  });
  if (wide.addEventListener) wide.addEventListener('change', renderPg);
  renderPg();

  // Replay demo: if the demo is out of view, scroll it in first and replay when the scroll
  // ends, so the (short) effects are not over before they are visible.
  var stage = document.getElementById('stage'), demo = document.getElementById('demo');
  function replayDemo() {
    title.play();
    heroText.play();
    nav.forEach(function (inst) { inst.play(); });
    images.forEach(function (g) { if (g.img.id !== 'img-preview') g.play(); });
  }
  document.getElementById('tune-replay').addEventListener('click', function () {
    var r = stage.getBoundingClientRect();
    if (r.bottom > site.offsetHeight && r.top < innerHeight) { replayDemo(); return; }
    var done = false, timer = 0;
    function go() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('scrollend', go);
      replayDemo();
    }
    window.addEventListener('scrollend', go);
    timer = setTimeout(go, 1200); // browsers without scrollend, or no scroll needed after all
    demo.scrollIntoView();
  });
  var copyBtn = document.getElementById('tune-copy');
  copyBtn.addEventListener('click', function () {
    var done = function (ok) {
      copyBtn.textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(function () { copyBtn.textContent = 'Copy config'; }, 1500);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(snippet.textContent || '').then(function () { done(true); }, function () { done(false); });
    else done(false);
  });

  applyAll();
  title.play();
  setTimeout(function () { heroText.play(); }, 250);
  nav.forEach(function (inst, i) { setTimeout(function () { inst.play(); }, 450 + 110 * i); });
  setTimeout(function () { images[0].play(); }, 900);
})();
