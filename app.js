const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersReduced = () => motionQuery.matches;

const stages = [
  {
    console: 'STAGE 01 / 需求理解 · DONE',
    input: '“为运营团队做一个活动数据看板，含列表、筛选、详情抽屉与 CSV 导出，移动端可用。”',
    action: 'Planner 抽取目标、页面、约束与验收标准；必要时最多追问三个关键问题。',
    output: '结构化项目画像 + 验收标准 + 能力需求。',
    evidence: 'project-profile.json / acceptance.md',
  },
  {
    console: 'STAGE 02 / 团队推荐 · DONE',
    input: '项目画像 + 已发布角色原型。',
    action: '从受控角色库推荐完整编制；确定性校验能力、并发、工具、记忆与输出契约。',
    output: '7 个运行时成员；Frontend ×2；Verifier 系统独立。',
    evidence: 'team-v3.2.0.json / coverage.json',
  },
  {
    console: 'STAGE 03 / DAG 调度 · DONE',
    input: '团队编制 + 页面范围 + 验收标准。',
    action: '生成任务 DAG；计算依赖、并行分支、写作用域与关键路径。',
    output: '10 个任务节点；2 条并行前端分支；1 个有界 Repair 子工作流。',
    evidence: 'dag.json / schedule.json',
  },
  {
    console: 'STAGE 04 / 并行开发 · DONE',
    input: 'T-04 数据看板 + T-05 详情与导出。',
    action: 'Frontend A/B 并行实现；写作用域隔离；Integration 等待两个分支完成。',
    output: '页面、组件、路由与共享接口；两个前端分支写作用域隔离。',
    evidence: 'src/pages/report-dashboard.tsx / src/pages/report-detail.tsx',
  },
  {
    console: 'STAGE 05 / 浏览器验证 · FAIL',
    input: '可运行工程 + 验收标准。',
    action: '独立 Verifier 执行结构、依赖、tsc、Vite build、桌面/移动 Playwright、控制台与网络检查。',
    output: 'FAIL；失败签名 ac985aa3…4af8b；TS2322 类型不匹配。',
    evidence: 'verification/report.json / 4 张截图',
  },
  {
    console: 'STAGE 06 / 自愈修复 · RUN',
    input: '结构化失败报告 + 历史失败签名。',
    action: '选择 typescript-contract 策略；Repair 在限定源码范围内生成最小 Diff；完整复验。',
    output: 'Round 1 PASS；真实 Diff 已保存。',
    evidence: 'repairs/round-1.diff / strategy.json',
  },
  {
    console: 'STAGE 07 / 交付 · PASS',
    input: 'PASS 的验证报告 + 冻结团队版本。',
    action: '生成交付快照；写入运行清单、事件游标与证据索引。',
    output: '可运行前端工程 + 验证报告 + 修复 Diff + 事件记录。',
    evidence: 'delivery/manifest.json / events.jsonl',
  },
];

const stageTabs = Array.from(document.querySelectorAll('.stage-tab'));
const stageTabList = document.querySelector('.stage-tabs');
const stageDetail = document.querySelectorAll('[data-detail]');
const consoleStage = document.getElementById('console-stage');
const dagNodes = Array.from(document.querySelectorAll('.dag-node, .dag-mobile li'));
const dagEdges = Array.from(document.querySelectorAll('.dag-edge'));
const eventRows = Array.from(document.querySelectorAll('.event-row'));
const eventList = document.getElementById('event-list');
const handoffLinks = Array.from(document.querySelectorAll('[data-stage-link]'));
const replayBtn = document.getElementById('replay-btn');
let playTimer = null;

function setStage(index, scrollEvents = false) {
  const active = Math.max(0, Math.min(stages.length - 1, index));

  stageTabs.forEach((tab, i) => {
    const selected = i === active;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });

  const detail = stages[active];
  if (stageDetail[0]) stageDetail[0].textContent = detail.input;
  if (stageDetail[1]) stageDetail[1].textContent = detail.action;
  if (stageDetail[2]) stageDetail[2].textContent = detail.output;
  if (stageDetail[3]) stageDetail[3].textContent = detail.evidence;
  if (consoleStage) consoleStage.textContent = detail.console;

  dagNodes.forEach((node) => {
    const group = Number(node.dataset.nodeGroup);
    const isFailedVerification = group === 4 && active >= 4;
    node.classList.toggle('is-done', (group < active && !isFailedVerification) || (active === 6 && group === 6));
    node.classList.toggle('is-current', group === active && active < 6);
    node.classList.toggle('is-fail', isFailedVerification);
  });

  dagEdges.forEach((edge) => {
    const doneAt = Number(edge.dataset.edgeDoneAt ?? edge.dataset.edgeTo);
    const reached = active >= doneAt;
    edge.classList.toggle('is-done', reached);
    edge.classList.toggle('is-future', !reached);
  });

  eventRows.forEach((row) => {
    const rowStage = Number(row.dataset.stage);
    const type = row.querySelector('.type')?.textContent ?? '';
    row.classList.toggle('is-future', rowStage > active);
    row.classList.toggle('is-current', rowStage === active);
    row.classList.toggle('is-fail', type === 'verification.failed');
    row.classList.toggle('is-pass', type === 'verification.passed' || type === 'delivery.ready');
  });

  handoffLinks.forEach((link, i) => link.classList.toggle('is-active', i === active));

  if (scrollEvents && eventList) {
    const target = eventRows.find((row) => Number(row.dataset.stage) === active);
    if (target) {
      const top = Math.max(0, target.offsetTop - 8);
      eventList.scrollTo({ top, behavior: prefersReduced() ? 'auto' : 'smooth' });
    }
  }
}

function stopPlay() {
  if (playTimer !== null) {
    window.clearTimeout(playTimer);
    playTimer = null;
  }
  if (replayBtn) {
    replayBtn.disabled = false;
    const label = replayBtn.querySelector('span');
    if (label) label.textContent = '重放执行';
  }
}

function playRun() {
  stopPlay();
  if (prefersReduced()) {
    setStage(6, true);
    return;
  }

  replayBtn.disabled = true;
  const label = replayBtn.querySelector('span');
  if (label) label.textContent = '执行中…';

  let index = 0;
  const step = () => {
    setStage(index, true);
    index += 1;
    if (index < stages.length) {
      playTimer = window.setTimeout(step, index === 5 ? 1400 : 950);
    } else {
      playTimer = null;
      replayBtn.disabled = false;
      if (label) label.textContent = '重放执行';
    }
  };

  step();
}

stageTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => {
    stopPlay();
    setStage(index, true);
  });
});

stageTabList?.addEventListener('keydown', (event) => {
  const current = stageTabs.indexOf(document.activeElement);
  if (current === -1) return;

  let next = current;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % stageTabs.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + stageTabs.length) % stageTabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = stageTabs.length - 1;
  else return;

  event.preventDefault();
  stopPlay();
  setStage(next, true);
  stageTabs[next].focus();
});

replayBtn?.addEventListener('click', playRun);

handoffLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const index = Number(link.dataset.stageLink);
    stopPlay();
    setStage(index, true);
    document.getElementById('execution')?.scrollIntoView({
      behavior: prefersReduced() ? 'auto' : 'smooth',
      block: 'start',
    });
  });
});

/* Evidence file tabs */

const fileTabs = Array.from(document.querySelectorAll('.file-tree [role="tab"]'));
const previewPath = document.getElementById('preview-path');

function selectFileTab(tab) {
  fileTabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(`panel-${item.dataset.tab}`);
    if (panel) panel.hidden = !selected;
  });
  if (previewPath) {
    const path = tab.querySelector('.file-path')?.textContent ?? '';
    previewPath.textContent = path;
  }
}

fileTabs.forEach((tab, index) => {
  tab.tabIndex = index === 0 ? 0 : -1;
  tab.addEventListener('click', () => selectFileTab(tab));
  tab.addEventListener('keydown', (event) => {
    const current = fileTabs.indexOf(tab);
    let next = current;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % fileTabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + fileTabs.length) % fileTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = fileTabs.length - 1;
    else return;

    event.preventDefault();
    selectFileTab(fileTabs[next]);
    fileTabs[next].focus();
  });
});

/* Mobile navigation */

const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.getElementById('site-nav');

function closeMenu() {
  if (!siteNav || !menuToggle) return;
  siteNav.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', '打开导航');
}

menuToggle?.addEventListener('click', () => {
  if (!siteNav) return;
  const open = siteNav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
});

siteNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeMenu);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

document.addEventListener('click', (event) => {
  if (!siteNav || !menuToggle) return;
  if (!siteNav.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
});

/* Scroll progress and navigation state */

const progress = document.getElementById('run-progress');
const navLinks = new Map(
  Array.from(document.querySelectorAll('[data-nav]')).map((link) => [link.dataset.nav, link]),
);
const watchedSections = Array.from(navLinks.keys())
  .map((id) => document.getElementById(id))
  .filter(Boolean);

function updateProgress() {
  if (!progress) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  progress.style.width = `${ratio * 100}%`;
}

window.addEventListener('scroll', updateProgress, { passive: true });
window.addEventListener('resize', updateProgress);
window.addEventListener('load', updateProgress);

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = navLinks.get(entry.target.id);
        if (!link) return;
        if (entry.isIntersecting) {
          navLinks.forEach((item) => item.removeAttribute('aria-current'));
          link.setAttribute('aria-current', 'true');
        } else if (link.getAttribute('aria-current') === 'true') {
          link.removeAttribute('aria-current');
        }
      });
    },
    { rootMargin: '-24% 0px -64% 0px', threshold: 0 },
  );
  watchedSections.forEach((section) => observer.observe(section));
}

setStage(5, false);
updateProgress();
