# README.md — 模板导览（给人看）

> 「项目档案生成」模板包：首次进项目勘察、提问，把答案固化成项目根 `AGENTS.md`；之后每次会话只读它。
> **规则只有一个来源：`_template\AGENTS.protocol.md`。** 本文件只做导览，不写规则；模型不读本文件。
> 位置：项目根下 `_template\`；产物是项目根 `AGENTS.md`。

## 1. 目录结构

| 路径 | 作用 |
|---|---|
| `_template\BOOTSTRAP.md` | 入口：拖给 Agent 或贴内容，启动生成流程 |
| `_template\AGENTS.protocol.md` | 唯一规则源：勘察 / 提问 / 落盘 / 自检 / 增量更新 / 模块 |
| `_template\AGENTS.templates\generated.md` | 产物空壳（照填） |
| `_template\AGENTS.templates\module-skeleton.md` | 新模块骨架 |
| `_template\AGENTS.modules\` | 技术栈规则库（按栈取用，现有文件见目录） |
| `_template\README.md` | 本文件 |

三种名字别混：`AGENTS.md` 是产物（项目根），`AGENTS.protocol.md` 是协议，`AGENTS.modules\` / `AGENTS.templates\` 是库与空壳，都不叫 `AGENTS.md`。

## 2. 第一次用（每个项目一次）

1. 整个 `_template\` 复制到项目根。
2. 把 `_template\BOOTSTRAP.md` 拖给 Agent（或贴内容；命令行直接说「读 `_template\BOOTSTRAP.md`」）。
3. 按协议 §3 第 2 步答题。

## 3. 之后怎么用

- 根 `AGENTS.md` 每次会话自动加载，模型直接开工。
- 加材料、换语言、加子工程：说一句，走协议 §9「增量更新」。

## 4. 出问题去哪查

| 现象 | 看 |
|---|---|
| 档案形式不达标 / 想核对 | 协议 §5 自检 |
| 不知道会问你什么 | 协议 §3 第 2 步 |
| 缺技术栈模块 | 协议 §8 |
| 更新会不会覆盖手改内容 | 协议 §9 |
| 规模 / 行数 | 协议 §4.3 |
| 目录多到装不下 | 协议 §4.1 第 10 条 |
| 设计上的坑 | 协议 §10 |

## 5. 一句话

模板只负责把上下文固化下来；它跑得对不对看协议，档案对不对人拍板。
