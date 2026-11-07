# Future Cup · 智能体调度平台官网

Future Cup 的静态单页官网：受控 Agent 团队、任务 DAG、真实浏览器验证与最多三轮有界自愈，交付带验证证据的可运行工程。

- 线上地址：<https://zamp1e.github.io/future-cup-website/>
- 仓库：<https://github.com/Zamp1e/future-cup-website>

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

## 目录

- `index.html` — 单页官网结构
- `styles.css` / `app.js` — 页面样式与交互
- `assets/` — 品牌、图版与验证证据截图
- `public/demo/hq/` — Agent HQ 智能总部演示页（线上路径 `/demo/hq/`）
- `scripts/` — 截图、分节与验证脚本
- `DESIGN.md` / `PRODUCT.md`（仓库外）— 设计与产品说明
