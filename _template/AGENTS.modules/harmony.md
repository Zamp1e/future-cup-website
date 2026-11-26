# 模块：HarmonyOS / ArkUI（hvigor 工程）

> 仅当 PROFILE「技术栈」为 HarmonyOS / ArkUI 时使用。未启用时不要读本文件。

## 页面结构

- `@Entry` + `@Component` + `build()`，样式用属性链。
- 复用优先 `@Styles` / `@Extend` / `@Builder`。

## ArkTS 限制

无 `any` / `unknown`；无解构；无 `for..in`；无 `implements`；无 index signature；无 `as const`。

## 样式与资源

- 样式写法**先确认再动手**：开工前问用户「题目是否允许写 CSS / 样式文件，还是只能用 ArkUI 属性链」，答案必须写进 PROFILE 的「硬约束」。
- 题目没说明时按默认：只用属性链，不建 `.css` / `.hml` / `.js`；题目要求主题或样式文件时，以题目为准。
- 尺寸用 `vp`，字号用 `fp`。
- 资源：`$r('app.string.xxx')`、`$r('app.media.xxx')`、系统资源 `$r('sys.float.xxx')`。

## 构建

- 构建前必须设置 SDK 环境变量（如 `DEVECO_SDK_HOME`），命令写进 PROFILE。
- 目录名必须 ASCII（中文子目录会导致构建失败）；工程怎么划分按 PROFILE「组织方式」，模块不替你定。

## 截图（无设备 / 无预览器时）

1. 先明确告知："当前没有真机/模拟器/预览器，我产不出运行截图。"
2. 再索要清单：哪些页面、哪些状态（如「正常 / 异常」两种）、命名与顺序。
3. 用户截图后插入；按目标尺寸缩放，保证不出框。
4. 绝不拿文档示例图、往届截图、自绘模拟图充数。
