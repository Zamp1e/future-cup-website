/*
 * Future Cup · 协作建造舞台
 * 独立实现：多光标群 + 设计工具式建造编舞（画框 / 打字 / 钢笔 / 标尺 / 复制）
 * 内容始终存在于 DOM 中，脚本只负责「揭示」；无脚本、减少动效、脚本异常均有兜底。
 */
(() => {
  'use strict';

  const doc = document.documentElement;
  const body = document.body;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = () => window.innerWidth < 640;

  const ROLES = ['PLANNER', 'UI DESIGNER', 'TESTER', 'FRONTEND A', 'FRONTEND B', 'INTEGRATION', 'REPAIR', 'VERIFIER'];
  const COLORS = ['#5873F2', '#9E90F0', '#7FD9C8', '#FF8A5C', '#FFC94A', '#F26D9B', '#4FC3F7', '#A8E57C',
    '#F2EFE7', '#FF8A72', '#B79BFF', '#36D6C3', '#FFB55C', '#8FD0FF', '#E3B7FF', '#9BE8A0',
    '#FF9DB0', '#7BC8FF', '#FFD479', '#B0F0E4', '#C7A6FF', '#FFAE8F', '#8DE0A8', '#F5A9E1'];
  const SHAPES = {
    arrow: '<path d="M4 2.5 L4 20 L8.6 16 L11.6 22 L14.4 20.6 L11.4 14.8 L17 14.4 Z" fill="currentColor" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>',
    cross: '<g stroke="#fff" stroke-width="3.6" stroke-linecap="round"><path d="M12 3 V21 M3 12 H21"/></g><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 3 V21 M3 12 H21"/></g>',
    ibeam: '<g fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"><path d="M8 4 H16 M12 4 V20 M8 20 H16"/></g><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 4 H16 M12 4 V20 M8 20 H16"/></g>',
    pen: '<path d="M3.5 3.5 L14 7.5 L20.5 14 L9.5 20.5 Z" fill="currentColor" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.8" fill="#fff"/>',
    dup: '<path d="M9 7 L9 22 L12.8 18.6 L15.4 23.4 L17.8 22 L15.2 17.2 L20 16.8 Z" fill="#fff" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M4 2.5 L4 20 L8.6 16 L11.6 22 L14.4 20.6 L11.4 14.8 L17 14.4 Z" fill="currentColor" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>',
    ew: '<path d="M2 12 L7 7 V10 H17 V7 L22 12 L17 17 V14 H7 V17 Z" fill="currentColor" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>'
  };

  const layer = $('#cursor-layer');
  const overlay = $('#overlay-layer');
  const blueprint = $('#blueprint');
  const hud = $('#hud');
  const hudState = $('#hud-state');
  const hudBar = $('#hud-bar');
  const hudCount = $('#hud-count');

  const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const build = (k) => $(`[data-build="${k}"]`);

  // head 内联脚本已在首屏前把主题写到 <html data-theme>，这里沿用，避免刷新闪回默认墨色
  const THEME_DEFAULT = doc.dataset.theme === 'paper' ? 'paper' : 'ink';
  let CFG;
  try { CFG = Object.assign({ theme: THEME_DEFAULT, speed: 1.5, agents: 14 }, JSON.parse(localStorage.getItem('fc-stage') || '{}')); }
  catch (e) { CFG = { theme: THEME_DEFAULT, speed: 1.5, agents: 14 }; }
  if (CFG.theme !== 'ink' && CFG.theme !== 'paper') CFG.theme = THEME_DEFAULT;
  const saveCfg = () => { try { localStorage.setItem('fc-stage', JSON.stringify(CFG)); } catch (e) { /* file:// 下忽略 */ } };

  const mouse = { x: 0, y: 0, active: false };
  let cursors = [], gen = 0, done = 0, total = 1, time = 0, last = 0, running = false;

  /* ------------------------------------------------------------- 光标群 */

  function makeCursor(i) {
    const el = document.createElement('div');
    el.className = 'cursor';
    el.style.setProperty('--c', COLORS[i % COLORS.length]);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = SHAPES.arrow;
    const tag = document.createElement('span');
    tag.className = 'cursor-tag';
    el.append(svg, tag);
    layer.appendChild(el);
    return { el, svg, tag, x: 0, y: 0, vx: 0, vy: 0, busy: false, shape: 'arrow',
      orbit: 74 + Math.random() * 108, phase: Math.random() * 6.28, spin: Math.random() < .5 ? -1 : 1 };
  }

  function syncCursors(n) {
    while (cursors.length < n) cursors.push(makeCursor(cursors.length));
    while (cursors.length > n) cursors.pop().el.remove();
    cursors.forEach((c, i) => { c.tag.textContent = ROLES[i] || `AGENT ${String(i + 1).padStart(2, '0')}`; });
    hudCount.textContent = String(n);
  }

  function setShape(c, shape) {
    if (c.shape === shape) return;
    c.shape = shape;
    c.svg.innerHTML = SHAPES[shape] || SHAPES.arrow;
  }

  function scatter() {
    cursors.forEach((c, i) => {
      const left = i % 2 === 0;
      c.x = left ? -60 - Math.random() * 240 : window.innerWidth + 60 + Math.random() * 240;
      c.y = Math.random() * window.innerHeight;
      c.vx = c.vy = 0; c.busy = false;
      c.el.classList.remove('is-quiet');
      setShape(c, 'arrow');
    });
  }

  function loop(now) {
    const dt = Math.min(.04, (now - (last || now)) / 1000);
    last = now; time += dt;
    const cx = mouse.active ? mouse.x : window.innerWidth * .5 + Math.sin(time * .32) * window.innerWidth * .18;
    const cy = mouse.active ? mouse.y : window.innerHeight * .46 + Math.cos(time * .27) * window.innerHeight * .13;

    for (const c of cursors) {
      if (!c.busy) {
        const dx = c.x - cx, dy = c.y - cy, d = Math.hypot(dx, dy) || 1;
        const nx = dx / d, ny = dy / d;
        const rr = c.orbit + 24 * Math.sin(time * .8 + c.phase);
        const radial = (rr - d) * 2.1;
        const tangent = c.spin * (92 + 28 * Math.sin(time * .5 + c.phase));
        let ax = -ny * tangent + nx * radial, ay = nx * tangent + ny * radial;
        for (const o of cursors) {
          if (o === c) continue;
          const ox = c.x - o.x, oy = c.y - o.y, dd = ox * ox + oy * oy;
          if (dd > 0 && dd < 1600) { const f = (1600 - dd) / 1600 * 300 / Math.sqrt(dd); ax += ox * f; ay += oy * f; }
        }
        if (mouse.active) {
          const mx = c.x - mouse.x, my = c.y - mouse.y, md = Math.hypot(mx, my) || 1;
          if (md < 66) { ax += mx / md * 1100; ay += my / md * 1100; }
        }
        c.vx = (c.vx + ax * dt) * .9; c.vy = (c.vy + ay * dt) * .9;
        const sp = Math.hypot(c.vx, c.vy);
        if (sp > 820) { c.vx *= 820 / sp; c.vy *= 820 / sp; }
        c.x += c.vx * dt; c.y += c.vy * dt;
      }
      c.el.style.transform = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,0)`;
    }
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------- 时间线与建造动作 */

  function tween(ms, fn) {
    const g = gen, dur = Math.max(1, ms / CFG.speed);
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        if (g !== gen) { resolve(false); return; }
        const t = Math.min(1, (now - t0) / dur);
        fn(t);
        if (t < 1) requestAnimationFrame(step); else resolve(true);
      };
      requestAnimationFrame(step);
    });
  }
  const wait = (ms) => tween(ms, () => {});

  async function moveTo(c, x, y, ms = 360) {
    const sx = c.x, sy = c.y;
    await tween(ms, (t) => { const e = easeInOut(t); c.x = sx + (x - sx) * e; c.y = sy + (y - sy) * e; });
  }

  function selection(x, y) {
    const el = document.createElement('div');
    el.className = 'selection';
    el.style.cssText = `left:${x}px;top:${y}px;width:0;height:0`;
    el.innerHTML = '<div class="sel-placeholder"></div><span class="sel-badge">0 × 0</span>' +
      '<i class="handle tl"></i><i class="handle tr"></i><i class="handle bl"></i><i class="handle br"></i>';
    overlay.appendChild(el);
    return { el, badge: el.querySelector('.sel-badge') };
  }

  function settle(s, el) {
    el.classList.add('is-built');
    s.el.classList.add('is-done');
    setTimeout(() => s.el.remove(), 450);
  }

  async function frameOut(c, el, pause = 100) {
    const r = rectOf(el);
    if (r.w < 2 || r.h < 2) { el.classList.add('is-built'); return null; }
    await moveTo(c, r.x - 8, r.y - 8, 320);
    setShape(c, 'cross');
    const s = selection(r.x, r.y);
    await tween(500, (t) => {
      const e = easeOut(t), w = r.w * e, h = r.h * e;
      s.el.style.width = w + 'px'; s.el.style.height = h + 'px';
      s.badge.textContent = `${Math.round(w)} × ${Math.round(h)}`;
      c.x = r.x + w; c.y = r.y + h;
    });
    c.el.classList.add('is-pressing');
    await wait(pause);
    c.el.classList.remove('is-pressing');
    setShape(c, 'arrow');
    return s;
  }

  async function drawBox(c, el) {
    const s = await frameOut(c, el);
    if (s) settle(s, el);
    await wait(120);
  }

  async function typeLine(c, el) {
    const s = await frameOut(c, el, 70);
    if (!s) return;
    // 画框结束后撤掉灰色占位，只留蓝色选区边，文字才看得清
    const ph = s.el.querySelector('.sel-placeholder');
    if (ph) ph.style.opacity = '0';
    const r = rectOf(el);
    const chars = Number(el.dataset.chars) || el.textContent.length || 1;
    setShape(c, 'ibeam');
    c.x = r.x; c.y = r.y + r.h * .62;
    el.classList.add('is-typing');
    el.style.setProperty('--reveal', '0%');
    await tween(600, (t) => {
      const q = Math.floor(t * chars) / chars;
      el.style.setProperty('--reveal', (q * 100) + '%');
      c.x = r.x + r.w * q; c.y = r.y + r.h * .62;
    });
    el.style.setProperty('--reveal', '100%');
    el.classList.remove('is-typing');
    settle(s, el);
    setShape(c, 'arrow');
    await wait(100);
  }

  async function drawRule(c) {
    const el = $('#hero-rule');
    const r = rectOf(el);
    if (r.w < 2) return;
    el.style.width = '0px';
    const anchor = document.createElement('div');
    anchor.className = 'pen-anchor';
    anchor.style.cssText = `left:${r.x}px;top:${r.y}px`;
    overlay.appendChild(anchor);
    setShape(c, 'pen');
    await moveTo(c, r.x, r.y, 260);
    c.el.classList.add('is-pressing');
    await wait(80);
    c.el.classList.remove('is-pressing');
    await tween(500, (t) => {
      const w = r.w * easeInOut(t);
      el.style.width = w + 'px';
      c.x = r.x + w; c.y = r.y;
    });
    const end = anchor.cloneNode();
    end.style.left = (r.x + r.w) + 'px';
    overlay.appendChild(end);
    el.style.width = '';
    setShape(c, 'arrow');
    await wait(220);
    anchor.style.opacity = end.style.opacity = '0';
    setTimeout(() => { anchor.remove(); end.remove(); }, 400);
  }

  async function duplicate(c, from, to) {
    const a = rectOf(from), b = rectOf(to);
    if (b.w < 2) { to.classList.add('is-built'); return; }
    const tag = document.createElement('div');
    tag.className = 'dup-tag';
    tag.textContent = `⌥ +${Math.round(Math.abs(b.x - a.x))}`;
    tag.style.cssText = `left:${a.x}px;top:${Math.max(8, a.y - 26)}px`;
    overlay.appendChild(tag);
    setShape(c, 'dup');
    await moveTo(c, a.x + a.w / 2, a.y + a.h / 2, 280);
    c.el.classList.add('is-pressing');
    await tween(440, (t) => {
      const e = easeInOut(t);
      c.x = a.x + a.w / 2 + (b.x - a.x) * e;
      c.y = a.y + a.h / 2 + (b.y - a.y) * e;
      tag.style.left = (a.x + (b.x - a.x) * e) + 'px';
    });
    c.el.classList.remove('is-pressing');
    to.classList.add('is-built');
    setShape(c, 'arrow');
    tag.style.transition = 'opacity .3s';
    tag.style.opacity = '0';
    setTimeout(() => tag.remove(), 340);
  }

  async function pressButton(c, el) {
    const r = rectOf(el);
    if (r.w < 2) { el.classList.add('is-built'); return; }
    await moveTo(c, r.x + r.w * .74, r.y + r.h * .5, 260);
    c.el.classList.add('is-pressing');
    el.classList.add('is-pressed');
    await wait(150);
    c.el.classList.remove('is-pressing');
    setTimeout(() => el.classList.remove('is-pressed'), 500);
  }

  async function dragGuides(c) {
    const l1 = rectOf(build('l1'));
    const gv = $('#guide-v'), gh = $('#guide-h');
    gv.style.left = Math.max(24, l1.x - 22) + 'px';
    gh.style.top = Math.max(24, l1.y - 16) + 'px';
    $('#guide-v-tag').textContent = String(Math.round(l1.x));
    $('#guide-h-tag').textContent = String(Math.round(l1.y));
    blueprint.classList.add('is-ruling');
    setShape(c, 'ew');
    await moveTo(c, Math.max(24, l1.x - 22), 36, 240);
    await tween(420, (t) => { c.y = 36 + (window.innerHeight - 72) * easeOut(t); });
    setShape(c, 'arrow');
  }

  function take() { return cursors.find((c) => !c.busy) || cursors[0]; }

  async function withCursor(fn) {
    const c = take();
    c.busy = true;
    try { await fn(c); }
    finally { c.busy = false; done++; hudBar.style.width = Math.min(100, done / total * 100) + '%'; }
  }

  const stagger = (ms, fn) => async (c) => { await wait(ms); await fn(c); };

  // 按钮的建造编舞：光标拖出选区框 → 落位 → 再点一下。主 CTA 与下载按钮共用同一套
  const buildButton = (key) => async (c) => {
    const el = build(key);
    if (!el) return;
    const s = await frameOut(c, el);
    if (s) settle(s, el);
    await pressButton(c, el);
  };

  /* ----------------------------- 右侧协同面板：由光标逐条填入运行态 */
  const panelVisible = () => {
    const p = $('#build-panel');
    return !!p && p.getBoundingClientRect().width > 2;
  };

  function panelReset() {
    const p = $('#build-panel');
    if (!p) return;
    p.classList.add('is-writing');
    p.classList.remove('is-live');
    $$('#build-panel .is-in').forEach((el) => el.classList.remove('is-in'));
    const log = $('#build-panel .bp-log');
    if (log) log.classList.remove('has-output');
    const bar = $('#bp-bar');
    if (bar) bar.style.width = '0%';
  }

  function panelFinish() {
    const p = $('#build-panel');
    if (!p) return;
    p.classList.remove('is-writing');
    p.classList.add('is-live');
    const bar = $('#bp-bar');
    if (bar) bar.style.width = '';
  }

  async function framePanel(c) {
    if (!panelVisible()) return;
    const el = build('panel');
    const s = await frameOut(c, el, 80);
    if (!s) return;
    const ph = s.el.querySelector('.sel-placeholder');
    if (ph) ph.style.opacity = '0';
    settle(s, el);
    await wait(100);
  }

  async function fillPanel(c) {
    if (!panelVisible()) return;
    const items = [
      ...$$('#bp-graph .bp-edge'),
      ...$$('#bp-graph .bp-node'),
      ...$$('#build-panel .bp-line'),
      $('#bp-select-rect'),
      $('#bp-guide-line')
    ].filter(Boolean);
    const bar = $('#bp-bar');
    const log = $('#build-panel .bp-log');
    setShape(c, 'ibeam');
    for (let i = 0; i < items.length; i++) {
      const el = items[i], r = rectOf(el);
      await moveTo(c, r.x + r.w * .5, r.y + r.h * .5, 120);
      el.classList.add('is-in');
      if (el.classList.contains('bp-line') && log) log.classList.add('has-output');
      if (bar) bar.style.width = Math.round((i + 1) / items.length * 100) + '%';
      await wait(i < 5 ? 45 : 90);
    }
    setShape(c, 'arrow');
    await wait(140);
  }

  /* ------------------------------------------------------------- 主流程 */

  function updateBar() { hudBar.style.width = Math.min(100, done / total * 100) + '%'; }

  async function intro() {
    cursors.forEach((c) => { c.busy = true; });
    const cx = window.innerWidth * .5, cy = window.innerHeight * .46;
    const from = cursors.map((c) => ({ x: c.x, y: c.y }));
    await tween(880, (t) => {
      const e = easeOut(t);
      cursors.forEach((c, i) => {
        const a = (i / cursors.length) * Math.PI * 2 + .6;
        const tx = cx + Math.cos(a) * c.orbit, ty = cy + Math.sin(a) * c.orbit;
        c.x = from[i].x + (tx - from[i].x) * e;
        c.y = from[i].y + (ty - from[i].y) * e;
      });
    });
    cursors.forEach((c) => { c.busy = false; });
  }

  async function showAll() {
    gen++;
    doc.dataset.stage = 'live';
    body.classList.remove('is-locked');
    blueprint.classList.remove('is-ruling');
    $('#hero-rule').style.width = '';
    overlay.innerHTML = '';
    $$('[data-build]').forEach((el) => { el.classList.remove('is-typing'); el.classList.add('is-built'); });
    hud.classList.add('is-on', 'is-live');
    hudState.textContent = 'LIVE';
    hudBar.style.width = '100%';
    hudCount.textContent = String(CFG.agents);
    panelFinish();
  }

  async function runBuild() {
    gen++;
    const g = gen;
    done = 0;
    overlay.innerHTML = '';
    blueprint.classList.remove('is-ruling');
    doc.dataset.stage = 'building';
    body.classList.add('is-locked');
    $('#hero-rule').style.width = '';
    $$('[data-build]').forEach((el) => {
      el.classList.remove('is-built', 'is-typing', 'is-pressed');
      el.style.removeProperty('--reveal');
    });
    hud.classList.remove('is-live');
    hud.classList.add('is-on');
    hudState.textContent = 'BUILDING';
    hudBar.style.width = '0%';

    const isSmall = mobile();
    if (isSmall || !panelVisible()) panelFinish(); else panelReset();
    syncCursors(isSmall ? Math.min(8, CFG.agents) : CFG.agents);
    scatter();

    // 桌面：完整编舞；移动端：只建造三行标题与按钮，其余直接呈现
    const schedule = [];
    if (isSmall) {
      $$('[data-build]').forEach((el) => { if (!['l1', 'l2', 'l3', 'cta', 'download'].includes(el.dataset.build)) el.classList.add('is-built'); });
      schedule.push([
        stagger(0, (c) => typeLine(c, build('l1'))),
        stagger(160, (c) => typeLine(c, build('l2'))),
        stagger(320, (c) => typeLine(c, build('l3')))
      ]);
      schedule.push([buildButton('cta'), buildButton('download')]);
    } else {
      schedule.push([
        dragGuides,
        (c) => drawBox(c, build('github')),
        (c) => drawBox(c, build('entry')),
        (c) => drawBox(c, build('meta')),
        (c) => drawBox(c, build('kicker')),
        framePanel
      ]);
      schedule.push([
        stagger(0, (c) => typeLine(c, build('l1'))),
        stagger(170, (c) => typeLine(c, build('l2'))),
        stagger(340, (c) => typeLine(c, build('l3')))
      ]);
      schedule.push([
        drawRule,
        (c) => drawBox(c, build('lede')),
        buildButton('cta'),
        buildButton('download'),
        fillPanel
      ]);
      schedule.push([(c) => drawBox(c, build('cap1'))]);
      schedule.push([
        (c) => duplicate(c, build('cap1'), build('cap2')),
        (c) => duplicate(c, build('cap1'), build('cap3')),
        (c) => drawBox(c, build('status'))
      ]);
    }

    total = schedule.reduce((n, group) => n + group.length, 0);
    updateBar();

    await intro();
    if (g !== gen) return;

    for (const group of schedule) {
      await Promise.all(group.map((fn) => withCursor(fn)));
      if (g !== gen) return;
    }

    await wait(300);
    if (g !== gen) return;
    blueprint.classList.remove('is-ruling');
    overlay.innerHTML = '';
    $$('[data-build]').forEach((el) => { el.classList.remove('is-typing'); el.classList.add('is-built'); });
    $('#hero-rule').style.width = '';
    doc.dataset.stage = 'live';
    body.classList.remove('is-locked');
    hud.classList.add('is-live');
    hudState.textContent = 'LIVE';
    hudBar.style.width = '100%';
    panelFinish();
  }

  /* ------------------- 右侧卡片：指针跟随 3D 倾斜 + 径向流光 + 弹簧回正 */

  function bindPanelTilt() {
    const wrap = $('#panel-tilt');
    const panel = $('#build-panel');
    const slot = wrap && wrap.parentElement;
    if (!wrap || !panel || !slot || reduced) return;

    const MAX_TILT = 11;     // 最大倾角（度）
    const STIFFNESS = .16;   // 弹簧刚度（约 14% 过冲 / 0.6s 收敛）
    const DAMPING = .68;     // 阻尼系数（<1，回正时带阻力回弹）
    const s = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    let raf = 0, hovering = false;

    const paint = () => {
      wrap.style.setProperty('--ry', `${(s.x * MAX_TILT).toFixed(3)}deg`);
      wrap.style.setProperty('--rx', `${(-s.y * MAX_TILT).toFixed(3)}deg`);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    function frame() {
      // 建造动画期间强制回正：选框测量基于 getBoundingClientRect，倾斜会让它偏移
      if (doc.dataset.stage === 'building') { s.tx = 0; s.ty = 0; }
      s.vx = (s.vx + (s.tx - s.x) * STIFFNESS) * DAMPING;
      s.vy = (s.vy + (s.ty - s.y) * STIFFNESS) * DAMPING;
      s.x += s.vx;
      s.y += s.vy;

      const settled = Math.abs(s.tx - s.x) < .0008 && Math.abs(s.ty - s.y) < .0008 &&
                      Math.abs(s.vx) < .0008 && Math.abs(s.vy) < .0008;
      if (settled) {
        s.x = s.tx; s.y = s.ty; s.vx = 0; s.vy = 0;
        paint(); raf = 0;
        if (!hovering) wrap.classList.remove('is-active');
        return;
      }
      paint();
      raf = requestAnimationFrame(frame);
    }

    function track(e) {
      if (doc.dataset.stage === 'building') { if (hovering) release(); return; }
      // 用未倾斜的父容器做基准，避免自身 transform 造成反馈抖动
      const r = slot.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      s.tx = nx; s.ty = ny;
      panel.style.setProperty('--mx', `${((nx + 1) * 50).toFixed(2)}%`);
      panel.style.setProperty('--my', `${((ny + 1) * 50).toFixed(2)}%`);
      panel.style.setProperty('--sheen', '1');
      hovering = true;
      wrap.classList.add('is-active', 'is-hover');
      kick();
    }

    function release() {
      hovering = false;
      s.tx = 0; s.ty = 0;
      wrap.classList.remove('is-hover');
      panel.style.setProperty('--sheen', '0');
      kick();
    }

    wrap.addEventListener('pointerenter', track);
    wrap.addEventListener('pointermove', track);
    wrap.addEventListener('pointerdown', track);
    wrap.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') track(e); else release(); });
    wrap.addEventListener('pointercancel', release);
    wrap.addEventListener('pointerleave', release);
  }

  /* ------------------- 平台入口：按下 96% → 松手弹簧回弹 → 播完再跳转 */

  function bindPressLinks() {
    const links = $$('.btn-entry, .btn-primary');
    if (!links.length) return;

    const STIFFNESS = .16;
    const DAMPING = .72;
    const KICK = .045;    // 松手初速度：回弹越过 100% 约 4~5% 再收回
    const EPS = .0006;
    let pending = null;   // 正在播放弹簧的按钮，兼作防重复触发

    const setScale = (el, v) => el.style.setProperty('--press', v.toFixed(4));
    const clearScale = (el) => {
      el.style.removeProperty('--press');
      el.classList.remove('is-pressing');
    };

    function navigate(el) {
      const url = el.href;
      // 下载按钮：弹簧播完后用临时 <a download> 触发下载，而不是开新标签
      // （跨域时 download 属性会被忽略，但 GitHub 的 Content-Disposition: attachment 仍会下载）
      if (el.hasAttribute('data-download')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = el.dataset.download || '';
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      let w = null;
      // 注意：带 'noopener' feature 时 window.open 会返回 null，不能据此判断被拦截
      try { w = window.open(url, '_blank'); } catch (e) { /* 弹窗策略拦截 */ }
      if (w) {
        try { w.opener = null; } catch (e) { /* 跨域时忽略 */ }
        return;
      }
      window.location.assign(url);  // 兜底：退化为当前标签跳转
    }

    function spring(el, go) {
      let x = .96, v = KICK, frames = 0;
      const tick = () => {
        v = (v + (1 - x) * STIFFNESS) * DAMPING;
        x += v;
        frames++;
        setScale(el, x);
        if ((Math.abs(1 - x) < EPS && Math.abs(v) < EPS) || frames > 120) {
          clearScale(el);
          pending = null;
          if (go) navigate(el);   // 关键：动画完整播完才跳转
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    links.forEach((el) => {
      let pressed = false, pointerHandled = false, startRect = null;

      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (pending) return;
        pressed = true;
        startRect = el.getBoundingClientRect();  // 记录未缩放时的边界，供拖出判定
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        el.classList.add('is-pressing');
        setScale(el, .96);
      });

      el.addEventListener('pointerup', (e) => {
        if (!pressed) return;
        pressed = false;
        pointerHandled = true;
        if (pending) return;
        const r = startRect || el.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right &&
                       e.clientY >= r.top && e.clientY <= r.bottom;
        if (reduced) { clearScale(el); if (inside) navigate(el); return; }
        pending = el;
        spring(el, inside);
      });

      el.addEventListener('pointercancel', () => {
        if (!pressed) return;
        pressed = false;
        if (pending) return;
        pending = el;
        spring(el, false);
      });

      el.addEventListener('click', (e) => {
        e.preventDefault();  // 阻止浏览器立刻跳转
        if (pointerHandled) { pointerHandled = false; return; }
        if (pending === el) return;
        if (reduced) { navigate(el); return; }
        // 键盘 Enter/Space 不会触发 pointerdown，补一次按下态再弹回
        pending = el;
        el.classList.add('is-pressing');
        setScale(el, .96);
        spring(el, true);
      });
    });
  }

  /* ------------------------------------------------------------- 交互绑定 */

  let themeTimer = null;

  function applyCfg() {
    const theme = CFG.theme === 'paper' ? 'paper' : 'ink';
    CFG.theme = theme;
    doc.dataset.theme = theme;
    body.dataset.theme = theme; // 兼容仍按 body 取值的旧样式
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'ink' ? '#0e1512' : '#f2efe7';
    $$('.seg').forEach((seg) => {
      seg.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('is-on', String(CFG[seg.dataset.key]) === b.dataset.value);
      });
    });
    // 头部按钮与 Tweaks 面板共用同一份状态，任意一处切换都要同步另一处
    const toggle = $('#theme-toggle');
    if (toggle) {
      const next = theme === 'ink' ? '浅色' : '深色';
      const label = `切换到${next}主题`;
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
      const text = toggle.querySelector('.theme-label');
      if (text) text.textContent = next;
    }
  }

  function setTheme(theme) {
    CFG.theme = theme === 'paper' ? 'paper' : 'ink';
    saveCfg();
    doc.classList.add('theme-changing');
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => doc.classList.remove('theme-changing'), 400);
    applyCfg();
  }

  function setTweaks(open) {
    $('#tweaks').hidden = !open;
    $('#tweaks-trigger').setAttribute('aria-expanded', String(open));
  }

  function bind() {
    $('#tweaks-trigger').addEventListener('click', () => setTweaks($('#tweaks').hidden));
    $('#tweaks-close').addEventListener('click', () => setTweaks(false));
    $('#theme-toggle').addEventListener('click', () => setTheme(CFG.theme === 'ink' ? 'paper' : 'ink'));

    $$('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const k = seg.dataset.key;
      if (k === 'theme') { setTheme(b.dataset.value); return; }
      CFG[k] = Number(b.dataset.value);
      saveCfg(); applyCfg();
      if (k === 'agents' && !reduced) runBuild();
    }));

    document.addEventListener('click', (e) => {
      if (!$('#tweaks').hidden && !$('#tweaks').contains(e.target) && !$('#tweaks-trigger').contains(e.target)) setTweaks(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { setTweaks(false); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 't') setTweaks($('#tweaks').hidden);
    });

    window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }, { passive: true });
    document.addEventListener('mouseleave', () => { mouse.active = false; });

    let rt = null;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (doc.dataset.stage === 'building' && !reduced) showAll(); }, 220);
    });

    bindPanelTilt();
    bindPressLinks();
  }

  function boot() {
    const dots = $('#hud-dots');
    for (let i = 0; i < 4; i++) { const d = document.createElement('i'); d.style.background = COLORS[i]; dots.appendChild(d); }
    applyCfg(); bind();
    if (reduced) { showAll(); return; }
    if (!running) { running = true; requestAnimationFrame(loop); }
    runBuild();
  }

  // 等字体就绪再测量元素，避免标题尺寸跳动；1.2s 超时兜底
  let started = false;
  const start = () => { if (started) return; started = true; boot(); };
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
    setTimeout(start, 1200);
  } else start();
})();
