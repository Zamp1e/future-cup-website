# AGENTS.md — Future Cup 官网 项目档案

> 本文件是本项目的档案（生成物），不是协议模板；协议模板在 `_template\AGENTS.protocol.md`，技术栈规则在 `_template\AGENTS.modules\`。
> 新增题目材料、新子工程，或换了实现语言 / 新增辅助脚本语言时，回到模板重新勘察，只更新本文件 PROFILE 与启用的规则模块。
> 若本会话工作目录是某个子目录（如新拆的子工程目录），先读 `../AGENTS.md` 再动手。

---

## 项目档案（PROFILE）

<!-- PROFILE:START -->
| 项 | 内容 |
|---|---|
| 项目定位 | Future Cup 智能体调度平台的静态单页官网：讲清「受控 Agent 团队 · 任务 DAG · 真实浏览器验证 · 有界自愈」，把访问者引到平台 https://futurecup.tangruirui.space/。 |
| 交付物 | 代码：可构建的静态站点（根目录源码 + `npm run build` 产出的 `dist/`），无报告。 |
| 组织方式 | 单工程单页：页面源码在根目录，验证与截图脚本在 `scripts/`，品牌与证据素材在 `assets/`，演示页在 `public/demo/hq/`；拆独立子工程前先定目录名（见「待确认」）。 |
| 技术栈 | 原生 JavaScript（Node v24.16.0，临时栈约束）——页面为 HTML / CSS / JS，构建用 Vite ^5.4.10，验证用 Playwright ^1.59.0。 |
| 构建验证 | `npm run build` |
| 硬约束 | 无题目级硬性限制（本项目不是实验作业）：目录与文件命名沿用现有约定（`scripts/verify-*.mjs`、`public/<页面名>/`）；`assets/evidence/` 的 HQ 截图遵守 PolyForm Noncommercial License 1.0.0，必须保留 Required Notice（见 `assets/evidence/PROVENANCE.md`）。 |
| 禁区 | `_template/`（协议与模块库，只读）、`dist/`（构建产物，由 `npm run build` 重生成）、`node_modules/`、`assets/evidence/` 原图（证据，不重绘不替换）、根目录 `start-local.cmd` 与 `preview-desktop.png`（用户自用，不动）。 |
| 截图策略 | 用户不需要截图，直接部署后打开网站即可 |
| 进度 | 已完成：单页官网源码、构建配置、8 个现行 `verify-*.mjs`（theme 19 / tilt 22 / golden 17 / press 25 / mobile 32 / build 13 / download 16 / rest 23，合计 167）与 2 个分节截图脚本；2026-11-26 视觉改为平台工作台冷调浅蓝 + 白卡 + 黑色主按钮，右侧卡片倾斜改为外扩 112px、边框最大、向内递减；当天又统一卡片投影为「只向下 / 双层近实远柔 / 模糊大于偏移 / 扩散 ≤ 0 / 不透明度 ≤ 20%」，平台入口按钮改为选中放大 102%、按下弹簧压到 96%、松手按 ζ=1 临界阻尼回弹（手动初速度，落位后才跳转）；再补编舞谢幕：结束顿一拍 → 光标群汇入底部 HUD → 缩进新增的 LIVE 待命栏缓慢游动（CSS 动画，主线程不逐帧跑），CTA 角上留一个哨兵并连点两次（Web Animations，避免覆盖 `build-in` 后重播闪白），R 键重播；光标运动模型按 `latest-site` 原版还原（径向弹簧 + 切向力绕指针，轨道 74–182px、40px 互斥、66px 避让、阻尼 .9、上限 820），调速与光标数量设置保留；首屏标题改为 `SpecCoding / 前置， / 我们闭环`，全站平台入口指向 `https://futurecup.tangruirui.space/`，下载按钮指向 v3.0.2 安装包；`npm run build` 与上述 8 个脚本全部通过；源码已推 `main`、构建产物推 `gh-pages`（Pages 源），线上 https://zamp1e.github.io/future-cup-website/ 为最新版。待做：无明确待办，等下一轮需求。 |
| 待确认 | ① 是否拆独立子工程、目录命名规则（本轮选了「拆子工程或新增目录」但未给规则）；② README 提到 `DESIGN.md` / `PRODUCT.md` 在仓库外，需要时向用户要路径；③ `preview-desktop.png`、`start-local.cmd` 仍是用户自用的未跟踪文件，是否进 `.gitignore` 待定（`_template/` 与 `AGENTS.md` 已随 2026-11-26 的提交入库）；④ `assets/og.png` 仍是旧版白底青绿分享图，是否随新主题重绘待确认。 |
<!-- PROFILE:END -->

---

## 工作准则

1. 先看再改、最小改动：改前先读相关文件与 README；只动需求涉及的部分，不顺手重构能跑的代码。
2. 结构性问题先问：交付形态、工程数量、实现方式先确认；命名与写法自己定。
3. 先验证再声明：说「通过」前必须真跑 `npm run build` 与受影响的 verify 脚本并贴输出；没跑就写「未验证」。
4. 证据真实：截图与结果只能来自真实执行；产不出来直说并向用户索要。
5. 不臆造：路径、版本、API 查不到就写「未找到 / 不确定」。
6. 清临时文件：中间产物放临时目录，结束删除。
7. 不越界：不删他人文件、不改他人文档、不 commit / push、不擅自装全局依赖。
8. 先读目录地图再遍历：地图能回答的不要再 `ls` / `find`；地图与磁盘不符 → 先修正地图再干活。

---

## 规则模块（仅启用项）

规则按栈取 `_template\AGENTS.modules\<stack>.md`；已启用：无（临时栈约束，见下）（快照，缺栈以目录实际文件为准）。
栈不在库中（目录里没有对应模块）：一次性项目在此写「临时栈约束」3–5 行（版本 / 构建命令 / 运行命令 / 主要限制 / 常见坑），不建库文件。
第二个项目仍用到该栈才固化：问清那四件事，用 `_template\AGENTS.templates\module-skeleton.md` 建模块，先给用户过目，再写进 PROFILE「技术栈」并在此登记。

### 临时栈约束

- 版本：Node v24.16.0；Vite ^5.4.10；Playwright ^1.59.0（只用于 `scripts/`）。
- 构建：`npm run build` 产出 `dist/`；`vite.config.js` 的 `generateBundle` 额外搬运 `app.js`、`assets/evidence/` 原图与 `assets/og.png`。
- 运行：`npm run dev` 起开发服务（http://127.0.0.1:5173）；跑验证前必须 `npm run preview`（http://127.0.0.1:4173），`scripts/*.mjs` 全部按 4173 写死。
- 限制：纯静态，无后端、无运行时第三方依赖；`app.js` 是普通脚本、不经 Vite 打包，改完必须重新构建才进 `dist/`。
- 坑：`base: './'` 要求资源路径全用相对路径；旧 `scripts/verify.mjs` 按重构前选择器写，不能当回归基线。

## 目录地图

| 路径 | 用途 | 状态 |
|---|---|---|
| `assets/` | 品牌图、字体、OG 图与证据截图（含 `PROVENANCE.md` 来源表） | 只读素材 |
| `scripts/` | 8 个现行 `verify-*.mjs`、1 个重构前旧脚本与 2 个分节截图脚本 | 已完成 |
| `public/demo/hq/` | Agent HQ 只读执行视图演示页，构建后原样进 `dist/demo/hq/` | 已完成 |
| `dist/` | `npm run build` 产物，部署源 | 构建生成，勿手改 |
| `_template/` | 项目档案生成模板（协议 / 模块库 / 空壳） | 只读，不改 |

> 一行一目录，只写路径 / 用途 / 状态；不列文件；路径必须真实存在；目录增删后立刻改这张表。

---

## 收尾

1. 更新 PROFILE 的「进度」「待确认」。
2. 变更记录追加一行（日期 / 做了什么 / 为什么）。

## 变更记录

| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-11-26 | 项目档案初始化 | 首次落盘 |
| 2026-11-26 | 视觉同步 ruiruiai 平台前端：暖白新拟态单主题、Archivo、靛蓝主色；移除墨/纸切换与相关脚本；光标编舞/倾斜/弹簧全保留；7 个 verify 脚本适配并跑通 | 用户要求官网风格与平台前端一致，同时保留鼠标指针动画 |
| 2026-11-26 | UI 改为平台工作台冷调浅蓝 + 白卡 + 黑色主按钮 + 钢蓝强调色；光标群改为 Boids（对齐 / 分离 / 聚合 + 指针禁飞区），标签向外辐射；卡片倾斜外扩 112px、边框最大、向内递减并改用窗口级指针跟踪；开场构建编舞保留；verify 合计 138 项通过 | 用户提供平台工作台截图要求同步 UI，并指出虚拟光标离真实鼠标太近、卡片边缘鬼畜，需按 Boids 与渐变倾斜修正 |
| 2026-11-26 | 卡片投影统一为「只向下 / 双层近实远柔 / 模糊大于偏移 / 扩散 ≤ 0 / 不透明度 ≤ 20%」，Tweaks / HUD 复合投影并入 token；平台入口按钮改为三态弹簧（选中放大 102%、按下压到 96%、松开按 ζ=1 临界阻尼回弹，手动初速度，落位后才跳转），顺手把 verify-press / download / mobile 的采样改成落位值并新增临界阻尼断言；verify 合计 144 项通过 | 用户规定卡片投影参数，并要求按钮点击使用阻尼比 1、带手动速度、含选中 / 按下 / 松开三态的丝滑弹簧动画 |
| 2026-11-26 | 建造编舞补谢幕：结束顿一拍 → 光标群汇入底部 HUD → 缩进新增的 LIVE 待命栏缓慢游动（6 个，移动端 3 个，CSS `dockFloat` 动画，不再逐帧 rAF），进度条收起成徽章，CTA 角上留一个静止哨兵，R 键重播；`showAll()` 路径直接落到待命态；顺带修掉 `index.html` 的 10s 白屏兜底会掐断重播、以及 1× 速度下建造超 10s 被截断的问题；新增 `scripts/verify-rest.mjs`（19 项），verify 合计 163 项通过 | 用户反馈虚拟光标在编舞结束后仍持续绕鼠标盘飞、看得眼睛晕，并要求收尾后以动画形式在 LIVE 栏里待命，而不是直接藏起来 |
| 2026-11-26 | 光标运动模型按 `latest-site` 原版还原（径向弹簧 + 切向力绕指针，轨道 74–182px、40px 互斥、66px 避让、阻尼 .9、上限 820），替换掉 Boids；CTA 上的哨兵改为连点两次（光标 `sentinelClick`、按钮 `ctaDemoClick`，同相位弹簧下压，两轮后交还真实 hover / press，按钮选择器加 `html[data-stage]` 压过 `build-in` 揭示动画）；`scripts/verify-rest.mjs` 扩到 22 项（新增两次下压、光标同步缩放、回位），verify 合计 166 项通过 | 用户指定按 https://github.com/Zamp1e/future-cup-website/tree/latest-site 原版还原鼠标动画（调速设置保留），并要求收尾后停在进入平台按钮上的指针连点两次、按钮同步回弹 |
| 2026-11-26 | 首屏标题改为 `SpecCoding / 前置， / 我们闭环`（拉丁行单独 `.88em` + 行高补偿，否则 1180–1280px 会顶到右侧卡片），全站平台入口与页脚指向 `https://futurecup.tangruirui.space/`；哨兵连点的按钮动画改走 Web Animations，不再用 CSS `animation` 覆盖 `build-in`（覆盖后撤掉会从 `opacity: 0` 重播，黑按钮闪一下白）；`verify-rest` 加「连点全程不闪白」断言（23 项），verify 合计 167 项通过 | 用户要求改标题文案、官网指向改到新域名，并反馈动画结束后按钮莫名闪白 |
| 2026-11-26 | 源码推送到 `main`（用 `-s ours --allow-unrelated-histories` 合并旧 main：内容以当前站点为准，旧历史保留为父提交），构建产物推送到 `gh-pages`（Pages 实际源分支）；线上 https://zamp1e.github.io/future-cup-website/ 已切到新版，浏览器实测 0 页面错误、0 个 4xx、四处入口均指向 `futurecup.tangruirui.space` | 用户要求上传到 GitHub 仓库 `main` 并部署 Pages |
| 2026-11-26 | 首屏下载按钮改指 v3.0.2 安装包 `.../releases/download/v3.0.2/Future.Cup.Setup.3.0.2.exe`，保留 `data-download` 的 `<a download>` 触发方式（弹簧播完才下载、不开新标签）；`verify-download` 的桩响应改到 `releases/download/` 路径并同步断言（16 项，合计 167）；改动已推 `main` 与 `gh-pages`，线上已验证为新链接 | 用户指定最新安装包为 v3.0.2（文件名带版本号，发新版需同步改 `index.html` 的 href 与 `data-download`） |
| 2026-11-26 | 项目档案 `AGENTS.md` 与档案生成脚手架 `_template/`（12 个文件，28 KB）一并入库并推 `main`；`preview-desktop.png`、`start-local.cmd` 仍作为用户自用文件不跟踪 | 用户要求把脚手架和档案同步上传到仓库 |
