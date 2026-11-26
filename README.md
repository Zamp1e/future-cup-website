# Future Cup · 智能体调度平台官网

Future Cup 的静态单页官网：受控 Agent 团队、任务 DAG、真实浏览器验证与最多三轮有界自愈，交付带验证证据的可运行工程。

- 线上地址：<https://web.tangruirui.space/>（2026-11-11 起由本机 `npm run build` 部署）；仓库另有一份 GitHub Pages 镜像 <https://zamp1e.github.io/future-cup-website/>
- 仓库：<https://github.com/Zamp1e/future-cup-website>

部署命令（用户级技能 `my-server`）：

```bash
npm run build
bash ~/.workbuddy/skills/my-server/scripts/srv.sh deploy-clean dist
```

`vite.config.js` 的 `generateBundle` 会手动输出 `assets/evidence/` 原图、`app.js`（普通 defer 脚本）和 `assets/og.png`（OG/Twitter meta 里的路径 Vite 不自动处理，缺了会让分享预览图 404）。

## 本地开发

```bash
npm install
npm run dev      # http://127.0.0.1:5173
```

## 构建与部署

```bash
npm run build    # 产物输出到 dist/
```

`main` 分支保存源码；`gh-pages` 分支保存 `dist/` 的构建产物，GitHub Pages 直接从该分支发布。更新站点时：

```bash
npm run build
# 将 dist/ 内容提交到 gh-pages 分支并推送
```

## 明暗主题

头部右侧的一键按钮在「墨」（深色，默认）与「纸」（浅色）之间切换；右下角 Tweaks 面板里的「画布 墨 / 纸」是同一个开关，两处状态实时同步，选择保存在 `localStorage` 的 `fc-stage.theme`（沿用原有配置键）。`index.html` 的 head 内联脚本会在首屏前还原上次选择，避免刷新时闪回默认墨色。

主题变量定义在 `styles.css` 的 `:root[data-theme='ink']` / `:root[data-theme='paper']`，切换由 `app.js` 的 `setTheme()` / `applyCfg()` 统一处理。

头部两个辅助入口（主题切换、GitHub）是**无边框、无文字的纯图标**：`.theme-label` / `.github-label` 保留在 DOM 里但用 CSS 隐藏，语义完全靠按钮的 `aria-label` / `title` 承担（`applyCfg()` 会动态更新主题按钮的文案）。hover 只把图标换成主色并轻微上移，不出现填充方块；「进入平台」保留边框作为主 CTA。

需要先 `npm run preview`，再运行 `node scripts/verify-theme.mjs`（20 项检查：切换、同步、持久化、无闪回、键盘、移动端、减少动效）。注意旧的 `scripts/verify.mjs` 仍指向已重构前的 DOM 选择器，不能直接跑。

## 卡片的黄金比例与圆角

右侧卡片外形锁定 `552 × 341`（φ = 1.618）：`.build-slot` 固定设计宽度并设 `aspect-ratio: 1.618 / 1`，高度由比例推导；圆角 `14px`（原 3px），进度条改为胶囊圆角呼应。

- `.build-panel` 用 `height: 100%` + flex 纵向分配，`.bp-graph` 为 `flex: 1`、`.bp-svg` 弹性填充，DAG 不会把卡片撑破；`.build-panel::after` 的流光用 `border-radius: inherit` 跟随圆角裁切。
- DAG 的 `viewBox` 从 `360 × 126` 扩到 `520 × 126` 并重排节点坐标，让图形横向铺满新宽度而不留大片空白。
- 中等视口（1400 / 1320 / 1240 / 1140 / 1060px）对 `.build-slot` 做**整体等比 `scale()`**，而不是任由高度收缩把 DAG 单独压扁——这样 φ 与内部版式比例在所有视口都不变。`transform-origin: right center` 保证右对齐与垂直居中不变。档位按「卡片左缘始终在标题右缘之外」实测收敛，最小留白 40px。
- ≤1000px 仍按原设计隐藏卡片。

`node scripts/verify-golden.mjs`（17 项，覆盖 12 个视口：φ、圆角、标题间隙、DAG 高度、底部不裁切、无横向溢出）。

## 移动端适配

断点分三段，全部以实测数据收敛（见 `scripts/verify-mobile.mjs`，32 项覆盖 320/360/390/430/640/768/900/1000px 与 844×390 横屏）：

| 区间 | 处理 |
|---|---|
| ≤640px 手机 | 隐藏「进入平台」头部按钮与右侧卡片；图标按钮补到 **44×44** 最小触摸区；`.hero-inner { margin-block: auto }` 把 `1fr` 拉伸出的垂直空白均分到上下（CTA 下方空隙从 ~200px 降到 79~97px）；图标 18px；能力条两列 |
| 641–1000px 平板 | 卡片隐藏后右半边空 → `.frame` 收窄居中到 960px、标题放大到 `min(11.5vw, 13vh)`，让留白成为对称构图；Tweaks 面板随 44px 触发器下移到 76px |
| 横屏 / 低高度 | `@media (max-height: 520px)` 压缩标题、行距与内边距；允许自然纵向滚动（844×390 约 538px），但保证无横向溢出与元素重叠 |

安全区：`viewport-fit=cover` 已存在，新增 `env(safe-area-inset-*)` 用于 `.frame` 底部、`.site-header` 顶部、HUD / Tweaks / 页脚底部内边距。

移动端交互已验证：触摸 tap 会走完整的 96% → 弹簧过冲 1.048 → 播完才打开新标签；主题切换在 44px 点击区下正常；Tweaks 面板在 320px 下仍完整落在视口内。

两点如实说明：
- **横屏低高度不强制一屏**，改为可滚动（内容约 538px vs 视口 390px），比裁切安全。
- 641–1000px 没有强行塞回卡片——那个宽度下 φ 卡片要缩到 DAG 图约 70px 高，得不偿失；改用构图收窄解决。

`node scripts/verify-mobile.mjs`。判断「页脚是否压到悬浮按钮」要用 `.footer-links > *` 的实际内联矩形，`<p>` 容器占满整行会误报。

## 平台入口按钮：黄金比例圆角 + 按压弹簧 + 播完再跳转

两个入口（头部「进入平台」、首屏「在线体验」）沿用卡片的设计语言：

- **圆角按 φ 递减**：卡片 14px → 按钮 9px（14 / 1.618 ≈ 8.65）；内边距 `垂直 : 水平 = 1 : 1.618`（`10:16`、`17:28`）。
- **按压缩放用 CSS 独立 `scale` 属性**（`scale: var(--press, 1)`），不是 `transform`。因为 `[data-build].is-built` 的 `build-in` 和 `.is-pressed` 的 `press-pulse` 动画都写 `transform` 且带 fill mode，用 transform 会被永久覆盖。同时清掉了 `.btn-primary:active` 里的 `scale(.985)`，避免双重缩放。
- 交互：`pointerdown` → 96%；`pointerup` → 弹簧积分（刚度 .16 / 阻尼 .72 / 初速 .045）冲到 **1.048（+4.8%）** 再阻尼收敛到 1，约 28 帧 / 0.47s。
- **跳转延迟到动画播完**：`click` 里 `preventDefault()`，弹簧结束回调才调用 `window.open`。注意带 `noopener` feature 时 `window.open` 会返回 `null`（不能据此判定被拦截），所以先用普通 `window.open` 再置 `w.opener = null`；若确实被弹窗策略拦截，兜底为当前标签 `location.assign`。
- 键盘 Enter/Space（无 `pointerdown`）会补一次按下态再弹回；按住拖出元素外回弹但**取消跳转**；`prefers-reduced-motion` 直接跳转不播动画；`setPointerCapture` 保证按钮缩小后指针事件不丢。

`node scripts/verify-press.mjs`（19 项）。测「播完才跳转」不靠墙钟阈值——headless 的 rAF 帧率远高于 60fps，动画可能 170ms 就跑完；脚本在页面内逐帧采样并包装 `window.open`，直接断言**调用瞬间 `--press` 已清除、且时间在回弹峰值之后**。

### 「立即下载」按钮

首屏 CTA 旁新增一个下载入口，指向 `https://github.com/tangrui13131/ruiruiai/releases/download/v1.4.5/FutureCup-Setup-x64.exe`（2026-11-14 由 v1.4.6 的 zip 换为 v1.4.5 的 Windows 安装包）。

- 直接复用 `.btn-primary` class（加 `.btn-download` 作钩子），因此圆角、内边距、字号、配色、hover、96% 按压与 1.048 弹簧回弹**全部与主 CTA 一致**，`bindPressLinks()` 会自动接管，无需另写一套交互。
- 用 `data-build="download"` 参与建造揭示态，并在 `runBuild()` 里与主 CTA **同组并发**走同一套光标编舞：`frameOut` 画框 → `settle` 落位 → `pressButton` 点一下（桌面第三组、移动端第二组，移动端白名单也加了 `download`）。这套流程抽成共用函数 `buildButton(key)`，两个分支不再重复；`total` 由 `schedule.reduce` 自动计算，增加一个并发任务不改组时长。
- 唯一差异在 `navigate()`：带 `data-download` 的按钮在弹簧播完后用临时 `<a download>` 触发下载，而不是 `window.open`。跨域时 `download` 属性会被忽略，但 GitHub 的 `Content-Disposition: attachment` 仍会正常下载；无 JS 时原生 `<a>` 也能直接下载。
- 响应式：≥390px 两按钮并排（间距 18–34px），320px 自动换行，各视口仍保持一屏。

`node scripts/verify-download.mjs`（14 项：UI 逐项比对、下载链接、按压弹簧、播完才下载、键盘、拖出取消、reduced motion）。验证用桩响应返回带 `Content-Disposition` 的假安装包（`application/octet-stream`），不发真实下载请求。

`node scripts/verify-build.mjs`（13 项）专门验证它确实进了开场动画：用 `MutationObserver` 记录两个按钮被 `is-built` 落位与被 `is-pressed` 点下的时刻，断言桌面/移动端都与主 CTA 同组并发、建造期间先隐藏、结束时完整可见，并抓取光标绘制的中间态截图。

## 右侧卡片的 3D 倾斜与反射流光

`.build-panel`（RUN #0428 构建面板）会跟随鼠标 / 触摸位置做透视倾斜，同时在指针处生成一圈径向反射高光；指针离开后用弹簧阻尼回正（约 14% 过冲、0.6s 收敛）。

实现要点：
- **倾斜必须在 `#panel-tilt` 外层**。`#build-panel` 自己带 `[data-build].is-built` 的入场 transform，两层分开才不会互相覆盖；透视 `perspective: 900px` 挂在 `.build-slot` 上。
- 角度基准用**未倾斜的父容器** `getBoundingClientRect()`，若用倾斜元素自身会形成反馈抖动。
- 弹簧是 `app.js` 里独立的 rAF 积分（`bindPanelTilt()`），静止后自动停帧；`prefers-reduced-motion` 与建造动画期间（`data-stage="building"`）自动禁用。
- 流光是 `.build-panel::after` 的两层 radial-gradient，颜色由主题的 `--sheen-core` / `--sheen-mid` 提供，浅色主题另用 `--sheen-glass` 压低整体亮度以保护文字可读性。

`node scripts/verify-tilt.mjs`（22 项：双向倾斜、流光跟随、触摸路径、弹簧过冲与精确回正、建造期禁用、双主题、窄屏、减少动效）。同样需要先 `npm run preview`。

## 目录

- `index.html` — 单页官网结构
- `scripts/verify-theme.mjs` — 明暗主题回归验证
- `scripts/verify-tilt.mjs` — 3D 倾斜与流光回归验证
- `scripts/verify-golden.mjs` — 黄金比例与响应式几何回归验证
- `scripts/verify-press.mjs` — 按压弹簧与延迟跳转回归验证
- `scripts/verify-mobile.mjs` — 移动端 / 平板 / 横屏适配回归验证
- `scripts/verify-download.mjs` — 「立即下载」按钮 UI 与弹簧下载回归验证
- `scripts/verify-build.mjs` — 开场光标建造编舞回归验证
- `styles.css` / `app.js` — 页面样式与交互
- `assets/` — 品牌、图版与验证证据截图
- `public/demo/hq/` — Agent HQ 智能总部演示页（线上路径 `/demo/hq/`）
- `scripts/` — 截图、分节与验证脚本
- `DESIGN.md` / `PRODUCT.md`（仓库外）— 设计与产品说明
