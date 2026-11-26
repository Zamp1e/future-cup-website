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
  // 与平台工作台同一套冷调色板：钢蓝 / 青 / 绿 / 少量橙色信号
  const COLORS = ['#3b6a9c', '#2f5f8f', '#4f7396', '#2b6777', '#2f7a6e', '#2f7d5b', '#4b6a5d', '#5f7a3f',
    '#6b5b95', '#5a6b8c', '#7a5f9e', '#b45309', '#9c5f2f', '#8a6a3a', '#c2410c', '#a35f5f',
    '#4f5d8c', '#3d5a80', '#556b87', '#6d597a', '#3f6b6b', '#7c8b5f', '#8c5f5f', '#476b4f'];
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
  const hudStage = $('#hud-stage');

  const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const build = (k) => $(`[data-build="${k}"]`);

  // 只保留动效偏好：速度与光标数量；旧的 theme 键即使留在 localStorage 里也会被忽略
  let CFG;
  try { CFG = Object.assign({ speed: 1.5, agents: 14 }, JSON.parse(localStorage.getItem('fc-stage') || '{}')); }
  catch (e) { CFG = { speed: 1.5, agents: 14 }; }
  delete CFG.theme;
  const saveCfg = () => { try { localStorage.setItem('fc-stage', JSON.stringify(CFG)); } catch (e) { /* file:// 下忽略 */ } };

  const mouse = { x: 0, y: 0, active: false };
  let cursors = [], gen = 0, done = 0, total = 1, time = 0, last = 0, running = false, resting = false;
  let quietTimer = 0, lastWake = 0;
  let dockTimer = 0;
  let demoAnims = [];

  /* 原版（latest-site）的力场参数都由常量直接写在 loop 里，这里不再单独配置 */

  /* 静止时光标标签降到低透明度，避免一屏深色标签盖住正文；指针一动就恢复 */
  function quietAll() {
    cursors.forEach((c) => c.el.classList.add('is-quiet'));
  }

  function wakeAll() {
    if (resting || !running) return;
    const now = performance.now();
    if (now - lastWake < 150) return;
    lastWake = now;
    cursors.forEach((c) => c.el.classList.remove('is-quiet'));
    clearTimeout(quietTimer);
    quietTimer = setTimeout(quietAll, 2200);
  }

  /* ------------------------------------------------------------- 光标群 */

  function makeCursor(i) {
    const el = document.createElement('div');
    el.className = 'cursor is-quiet';
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
      setShape(c, 'arrow');
    });
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min(.04, (now - (last || now)) / 1000);
    last = now; time += dt;
    const cx = mouse.active ? mouse.x : window.innerWidth * .5 + Math.sin(time * .32) * window.innerWidth * .18;
    const cy = mouse.active ? mouse.y : window.innerHeight * .46 + Math.cos(time * .27) * window.innerHeight * .13;
    for (const c of cursors) {
      if (!c.busy) {
        /* 原版（latest-site）力场：径向弹簧把光标拉回自己的轨道半径，切向力让它绕着指针转，
           40px 内互相排斥，66px 内避开真实指针——没有邻域对齐与聚合。 */
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

        // 标签朝鸟群外侧排布：左半边贴左、上半边贴上，减少聚集时的叠字
        c.el.classList.toggle('is-left', c.x < cx - 2 && c.x > 150);
        c.el.classList.toggle('is-up', c.y < cy - 2 && c.y > 80);
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
    c.el.classList.remove('is-quiet', 'is-left', 'is-up');
    try { await fn(c); }
    finally {
      c.busy = false;
      c.vx = 0; c.vy = 0;          // 编舞结束后从静止交还给鸟群，避免旧速度造成跳变
      c.el.classList.add('is-quiet');
      done++;
      hudBar.style.width = Math.min(100, done / total * 100) + '%';
    }
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

  /* ------------------------------------------------------------- 谢幕收尾 */

  function startLoop() {
    if (running) return;
    running = true; last = 0;
    requestAnimationFrame(loop);
  }

  // 停在 CTA 上的哨兵：不参与鸟群、不再移动，只作为「团队还在」的静态记号
  function parkSentinel() {
    const old = overlay.querySelector('.is-sentinel');
    if (old) old.remove();
    const el = build('cta');
    if (!el) return;
    const r = rectOf(el);
    if (r.w < 2) return;
    const s = document.createElement('div');
    s.className = 'cursor is-sentinel';
    s.style.setProperty('--c', COLORS[3]);
    s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SHAPES.arrow}</svg>`;
    s.style.transform = `translate3d(${(r.x + r.w - 6).toFixed(1)}px,${(r.y + r.h - 8).toFixed(1)}px,0)`;
    overlay.appendChild(s);
  }

  /* 待命：谢幕不把队伍收没，而是缩进 HUD 的 LIVE 栏里缓慢游动。
     游动交给 CSS 动画，主线程保持空闲——一个装饰动画不该让整页永不掉帧。 */
  function dockStop() {
    clearTimeout(dockTimer);
    cursors.forEach((c) => c.el.classList.remove('is-dock'));
  }

  function startDock() {
    cursors.forEach((c) => c.el.classList.remove('is-dock'));
    if (!hudStage) return;
    const r = hudStage.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const pad = 2;
    const zone = { x: r.left + pad, y: r.top + pad, w: r.width - pad * 2, h: r.height - pad * 2 };
    const n = Math.min(cursors.length, mobile() ? 3 : 6);
    const slot = zone.w / n;
    const half = 5.3;                                    // 24px 图标缩到 .44 之后的半宽，用来居中对齐栏位
    cursors.forEach((c, i) => {
      if (i >= n) { c.el.style.opacity = '0'; return; }  // 栏里挤不下的先退场
      c.el.style.opacity = '';
      c.el.style.setProperty('--dx', Math.min(3.5, slot / 2.8).toFixed(2) + 'px');
      c.el.style.setProperty('--dy', Math.max(1.5, zone.h / 2 - 5).toFixed(2) + 'px');
      c.el.style.setProperty('--dur', (6.5 + (i % 4) * 1).toFixed(2) + 's');
      c.el.style.setProperty('--delay', (-(i * 1.9)).toFixed(2) + 's');   // 错开相位，避免整排同呼吸
      c.el.style.transform =
        `translate3d(${(zone.x + (i + .5) * slot - half).toFixed(1)}px,${(zone.y + zone.h / 2 - half).toFixed(1)}px,0) scale(.44)`;
      c.el.classList.add('is-dock');
    });
  }

  // 待命栏的宽度是过渡出来的，等它落定再量
  function dockAfterRest() {
    clearTimeout(dockTimer);
    dockTimer = setTimeout(() => { if (resting) startDock(); }, 420);
  }

  /* 哨兵在 CTA 上连点两下：光标用弹簧压一下再弹回，按钮同步按下。
     走 Web Animations 而不是 CSS animation——一旦用 animation 简写盖掉
     [data-build].is-built 的 build-in 揭示动画，撤掉时 build-in 会重播，按钮会闪一下白。
     纯视觉演示，不触发跳转；两轮结束后自然回到真实的 hover / press。 */
  function demoClick() {
    const s = overlay.querySelector('.is-sentinel');
    const cta = build('cta');
    if (!s || !cta || reduced) return;
    const svg = s.querySelector('svg');
    if (!svg) return;
    const opts = { duration: 780, delay: 450, iterations: 2 };
    const click = (press, over, settle, breathe) => [
      { offset: 0, scale: '1', easing: 'ease-in-out' },
      { offset: .13, scale: press, easing: 'ease-in-out' },
      { offset: .32, scale: over, easing: 'ease-in-out' },
      { offset: .5, scale: settle, easing: 'ease-in-out' },
      { offset: .66, scale: breathe, easing: 'ease-in-out' },
      { offset: .8, scale: '1' },
      { offset: 1, scale: '1' },
    ];
    demoAnims.forEach((a) => { try { a.cancel(); } catch (e) { /* 已结束 */ } });
    demoAnims = [
      svg.animate(click('.78', '1.07', '.97', '1.015'), opts),
      cta.animate(click('.96', '1.022', '.997', '1.006'), opts),
    ];
  }

  /* 一次性谢幕：顿一下 → 汇入底部 HUD → 缩进待命栏 → 停鸟群 → 留哨兵。
     结束后运动只剩两处：栏里缓慢游动的几个小光标，和 LIVE 前那颗 6px 呼吸点。 */
  async function curtain() {
    if (resting) return;
    resting = true;
    layer.classList.add('is-docked');      // 提前抬层级：汇入时要从胶囊前面进去，而不是被它盖住
    cursors.forEach((c) => { c.busy = true; });
    running = false;                       // 先停鸟群，免得它覆盖汇入时的 transform
    await wait(160);                       // 这个顿点才是句号，否则像被掐断
    if (cursors.length) {
      const r = hud.getBoundingClientRect();
      const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
      const from = cursors.map((c) => ({ x: c.x, y: c.y }));
      const n = cursors.length;
      await tween(720, (t) => {
        cursors.forEach((c, i) => {
          const q = Math.max(0, Math.min(1, (t - (i / n) * .18) / .82));   // 依次汇入
          const e = easeInOut(q);
          const a = (i / n) * 6.283;                                     // 落在栏内一小圈上，免得叠成一坨
          const gx = tx + Math.cos(a) * 7, gy = ty + Math.sin(a) * 5;
          c.x = from[i].x + (gx - from[i].x) * e;
          c.y = from[i].y + (gy - from[i].y) * e;
          c.el.style.transform =
            `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,0) scale(${(1 - .58 * e).toFixed(3)})`;
        });
      });
      if (!resting) return;                // 期间被重播打断
    }
    layer.classList.add('is-docked');
    hud.classList.add('is-rest');
    parkSentinel();
    doc.dataset.stage = 'live';
    body.classList.remove('is-locked');
    quietAll();
    dockAfterRest();
    demoClick();
  }

  // 不播谢幕的路径（减少动效 / 生成中改窗口）：直接落到待命态
  function settleInstant() {
    resting = true;
    running = false;
    dockStop();
    layer.classList.remove('is-off');
    layer.classList.add('is-docked');
    hud.classList.add('is-rest');
    parkSentinel();
    dockAfterRest();
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
    settleInstant();
    quietAll();
  }

  async function runBuild() {
    gen++;
    const g = gen;
    done = 0;
    // 从待命态重入（Tweaks 改数量 / 按 R 重播）：把队伍从 LIVE 栏里放出来
    resting = false;
    dockStop();
    demoAnims.forEach((a) => { try { a.cancel(); } catch (e) { /* 已结束 */ } });
    demoAnims = [];
    layer.classList.remove('is-off', 'is-docked');
    hud.classList.remove('is-rest');
    cursors.forEach((c) => { c.el.style.opacity = ''; });
    startLoop();
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
    quietAll();

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
    hud.classList.add('is-live');
    hudState.textContent = 'LIVE';
    hudBar.style.width = '100%';
    panelFinish();
    await curtain();                       // 内容落定后再谢幕，最后才切到 live
  }

  /* ------------------- 右侧卡片：指针跟随 3D 倾斜 + 径向流光 + 弹簧回正 */

  function bindPanelTilt() {
    const wrap = $('#panel-tilt');
    const panel = $('#build-panel');
    const slot = wrap && wrap.parentElement;
    if (!wrap || !panel || !slot || reduced) return;

    const MAX_TILT = 11;        // 最大倾角（度）
    const OUTER_ZONE = 112;     // 卡片外框再往外扩的触发距离
    const INNER_FLOOR = .22;    // 进入卡片后，中心仍保留的倾斜比例
    const STIFFNESS = .16;      // 弹簧刚度（约 14% 过冲 / 0.6s 收敛）
    const DAMPING = .68;        // 阻尼系数（<1，回正时带阻力回弹）
    const s = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    let raf = 0, hovering = false;

    const paint = () => {
      wrap.style.setProperty('--ry', `${(s.x * MAX_TILT).toFixed(3)}deg`);
      wrap.style.setProperty('--rx', `${(-s.y * MAX_TILT).toFixed(3)}deg`);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    function frame() {
      // 建造动画期间强制回正：选框测量基于 getBoundingClientRect，倾斜会让它偏移
      if (doc.dataset.stage === 'building') {
        if (hovering) release();
        s.tx = 0; s.ty = 0;
      }
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

    /*
     * 外扩触发区：卡片外 112px 内开始倾斜，越靠近卡片越深，到视觉边框达到最大值；
     * 进入卡片后按「离最近边的距离」递减，中心保留 22%。
     * 用窗口指针坐标而不是 pointerenter/pointerleave，避免卡片抬升改变命中区导致边缘抖动。
     */
    function zoneOf(x, y) {
      const r = slot.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      const hw = r.width / 2, hh = r.height / 2;
      const dx = x - (r.left + hw), dy = y - (r.top + hh);
      const outsideX = Math.max(0, Math.abs(dx) - hw);
      const outsideY = Math.max(0, Math.abs(dy) - hh);
      const outside = Math.hypot(outsideX, outsideY);
      if (outside > OUTER_ZONE) return null;

      let strength;
      if (outside > 0) {
        strength = 1 - outside / OUTER_ZONE;              // 外扩区：0 → 1
      } else {
        const edge = Math.min(1 - Math.abs(dx) / hw, 1 - Math.abs(dy) / hh);
        strength = INNER_FLOOR + (1 - INNER_FLOOR) * (1 - Math.max(0, Math.min(1, edge)));
      }

      return {
        nx: Math.max(-1, Math.min(1, dx / hw)),
        ny: Math.max(-1, Math.min(1, dy / hh)),
        strength,
      };
    }

    function track(e) {
      if (doc.dataset.stage === 'building') { if (hovering) release(); return; }
      const z = zoneOf(e.clientX, e.clientY);
      if (!z) { if (hovering) release(); return; }
      s.tx = z.nx * z.strength;
      s.ty = z.ny * z.strength;
      panel.style.setProperty('--mx', `${((z.nx + 1) * 50).toFixed(2)}%`);
      panel.style.setProperty('--my', `${((z.ny + 1) * 50).toFixed(2)}%`);
      // 抬升也随接近程度平滑增长，避免在触发区外缘突然放大
      wrap.style.setProperty('--lift', (1 + .016 * z.strength).toFixed(4));
      panel.style.setProperty('--sheen', '1');
      hovering = true;
      wrap.classList.add('is-active', 'is-hover');
      kick();
    }

    function release() {
      if (!hovering) return;
      hovering = false;
      s.tx = 0; s.ty = 0;
      wrap.classList.remove('is-hover');
      wrap.style.removeProperty('--lift');
      panel.style.setProperty('--sheen', '0');
      kick();
    }

    // 用窗口级指针事件计算接近程度：卡片抬升 / 缩放不会再反过来影响触发
    window.addEventListener('pointermove', track, { passive: true });
    window.addEventListener('pointerdown', track, { passive: true });
    window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') track(e); else release(); });
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    document.addEventListener('mouseleave', release);
  }

  /* ------------------- 平台入口：选中变大 → 按下弹簧 → 松手回弹 → 播完再跳转 */
  /*
   * 弹簧阻尼比固定 ζ = 1（临界阻尼）：自身不会出现第二次振荡，
   * 松开时的那一下“回弹”由手动注入的初速度产生；曲线用解析解按时间求值，帧率不影响手感。
   * 三种状态：选中（放大 2%）/ 按下（弹簧压到 96%）/ 松开（回弹后落回原位或选中态）。
   */

  function bindPressLinks() {
    const links = $$('.btn-entry, .btn-primary');
    if (!links.length) return;

    const SELECTED = 1.02;   // 选中态：变大 2%
    const PRESSED = .96;     // 按下态：缩到 96%
    const ZETA = 1;          // 阻尼比固定为 1（临界阻尼，自身不振荡；下面的解析解按 ζ=1 推导）
    const OMEGA = { select: 22, press: 30, release: 20 };   // 固有频率 rad/s
    const KICK = { press: -1.2, release: 3.4 };             // 手动初速度 scale/s
    const EPS = .0005;
    let pending = null;   // 正在播放回弹的按钮，兼作防重复触发

    // 每个按钮的弹簧状态：当前位置 x、速度 v、指针 / 焦点标志
    const states = new WeakMap();
    const stateOf = (el) => {
      let s = states.get(el);
      if (!s) {
        s = { x: 1, v: 0, raf: 0, hover: false, focus: false, down: false, onDone: null };
        states.set(el, s);
      }
      return s;
    };
    const isSelected = (s) => s.hover || s.focus;
    const setScale = (el, v) => el.style.setProperty('--press', v.toFixed(4));
    const markSelected = (el, s) => el.classList.toggle('is-selected', isSelected(s));

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

    /* ζ = 1 的解析解：x(t) = target + (A + B t) e^(-ζωt)，A = x0 - target，B = v0 + ζωA */
    function springTo(el, target, v0, omega, onDone) {
      const s = stateOf(el);
      if (s.raf) cancelAnimationFrame(s.raf);
      s.onDone = onDone || null;
      const x0 = s.x;
      const t0 = performance.now();
      el.classList.add('is-springing');
      setScale(el, x0);   // 先落一帧当前值，CSS 的选中 fallback 不会抢先跳变
      const step = (now) => {
        const t = Math.max(0, (now - t0) / 1000);
        const damping = ZETA * omega;   // 临界阻尼：衰落系数就等于固有频率
        const A = x0 - target;
        const B = v0 + damping * A;
        const decay = Math.exp(-damping * t);
        s.x = target + (A + B * t) * decay;
        s.v = (B - damping * (A + B * t)) * decay;
        setScale(el, s.x);
        if (Math.abs(s.x - target) < EPS && Math.abs(s.v) < EPS * 10) {
          s.x = target;
          s.v = 0;
          s.raf = 0;
          el.classList.remove('is-springing');
          if (target === PRESSED) setScale(el, target);
          else el.style.removeProperty('--press');   // 交还 CSS：1 或选中 1.02
          const done = s.onDone;
          s.onDone = null;
          if (done) done();
          // 回弹途中指针又移进来：落位后补一段选中放大，避免跳变
          if (target !== PRESSED && !s.down && isSelected(s) && target !== SELECTED) {
            springTo(el, SELECTED, 0, OMEGA.select);
          }
          return;
        }
        s.raf = requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
    }

    links.forEach((el) => {
      const s = stateOf(el);
      let pressed = false, pointerHandled = false, startRect = null;

      const beginPress = () => {
        s.down = true;
        el.classList.add('is-pressing');
        if (reduced) { setScale(el, PRESSED); return; }   // 减少动效：直接落到按下态
        springTo(el, PRESSED, KICK.press, OMEGA.press);
      };

      const endPress = (go) => {
        s.down = false;
        el.classList.remove('is-pressing');
        if (reduced) {
          el.style.removeProperty('--press');
          el.classList.remove('is-selected');
          if (go) navigate(el);
          return;
        }
        // 松手：回弹到选中态（1.02）或原位（1），播完再跳转
        springTo(el, isSelected(s) ? SELECTED : 1, KICK.release, OMEGA.release, () => {
          pending = null;
          if (go) navigate(el);
        });
      };

      el.addEventListener('pointerenter', () => {
        s.hover = true;
        if (reduced) return;
        markSelected(el, s);
        if (s.down || pending === el) return;
        springTo(el, SELECTED, 0, OMEGA.select);
      });

      el.addEventListener('pointerleave', () => {
        s.hover = false;
        if (reduced) return;
        markSelected(el, s);
        if (s.down || pending === el) return;
        springTo(el, s.focus ? SELECTED : 1, 0, OMEGA.select);
      });

      // 键盘焦点（:focus-visible）同样算选中，鼠标点出来的焦点不放大
      el.addEventListener('focus', () => {
        if (reduced || !el.matches(':focus-visible')) return;
        s.focus = true;
        markSelected(el, s);
        if (s.down || pending === el) return;
        springTo(el, SELECTED, 0, OMEGA.select);
      });

      el.addEventListener('blur', () => {
        s.focus = false;
        if (reduced) return;
        markSelected(el, s);
        if (s.down || pending === el) return;
        springTo(el, s.hover ? SELECTED : 1, 0, OMEGA.select);
      });

      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (pending) return;
        s.hover = true;
        if (!reduced) markSelected(el, s);
        pressed = true;
        startRect = el.getBoundingClientRect();  // 记录未缩放时的边界，供拖出判定
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        beginPress();
      });

      el.addEventListener('pointerup', (e) => {
        if (!pressed) return;
        pressed = false;
        pointerHandled = true;
        if (pending) return;
        const r = startRect || el.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right &&
                       e.clientY >= r.top && e.clientY <= r.bottom;
        s.hover = inside;   // 指针捕获期间边界事件不可靠，以释放位置为准
        if (!reduced) markSelected(el, s);
        pending = el;
        endPress(inside);
      });

      el.addEventListener('pointercancel', () => {
        if (!pressed) return;
        pressed = false;
        if (pending) return;
        pending = el;
        endPress(false);
      });

      el.addEventListener('click', (e) => {
        e.preventDefault();  // 阻止浏览器立刻跳转
        if (pointerHandled) { pointerHandled = false; return; }
        if (pending === el) return;
        if (reduced) { navigate(el); return; }
        // 键盘 Enter/Space 不会触发 pointerdown：先弹簧按下，再松手回弹
        pending = el;
        beginPress();
        setTimeout(() => { if (pending === el) endPress(true); }, 90);
      });
    });
  }

  /* ------------------------------------------------------------- 交互绑定 */

  function applyCfg() {
    $$('.seg').forEach((seg) => {
      seg.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('is-on', String(CFG[seg.dataset.key]) === b.dataset.value);
      });
    });
  }

  function setTweaks(open) {
    $('#tweaks').hidden = !open;
    $('#tweaks-trigger').setAttribute('aria-expanded', String(open));
  }

  function bind() {
    $('#tweaks-trigger').addEventListener('click', () => setTweaks($('#tweaks').hidden));
    $('#tweaks-close').addEventListener('click', () => setTweaks(false));

    $$('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const k = seg.dataset.key;
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
      if (k === 'r' && resting) runBuild();     // 静息态按 R 重播整段建造
    });

    window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; wakeAll(); }, { passive: true });
    document.addEventListener('mouseleave', () => { mouse.active = false; });

    let rt = null;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (resting) { parkSentinel(); dockAfterRest(); return; }   // 栏位与 CTA 都变了位置，重新落位
        if (doc.dataset.stage === 'building' && !reduced) showAll();
      }, 220);
    });

    bindPanelTilt();
    bindPressLinks();
  }

  function boot() {
    // app.js 已经接管舞台：撤掉 index.html 的 10s 白屏兜底，否则重播会在第 10 秒被它掐断
    if (window.__fcFallback) { clearTimeout(window.__fcFallback); window.__fcFallback = 0; }
    const dots = $('#hud-dots');
    for (let i = 0; i < 4; i++) { const d = document.createElement('i'); d.style.background = COLORS[i]; dots.appendChild(d); }
    applyCfg(); bind();
    if (reduced) { showAll(); return; }
    startLoop();
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
