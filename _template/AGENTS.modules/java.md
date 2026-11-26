# 模块：Java（单文件命令行）

> 仅当 PROFILE「技术栈」为 Java 时使用。未启用时不要读本文件，也不要把内容写进生成物。

## 环境与版本

- JDK 17+；`javac` / `java` 直接编译运行，不引入构建工具，除非题目要求。

## 目录与构建

- 目录划分按 PROFILE「组织方式」；一个任务一个目录，入口 `Main.java`。
- 构建命令：`javac -encoding UTF-8 Main.java && java Main`（写进 PROFILE「构建验证」）。

## 代码约束

- 类名与文件名一致；公开类 `Main`；入口固定 `public static void main(String[] args)`。
- 不用第三方库；集合优先 `ArrayList` / `HashMap`，按题目要求排序。
- 输出逐字对齐样例：用 `System.out.printf` 控制小数位与宽度。
- 输入用 `Scanner`（小数据）或 `BufferedReader`（大数据）。

## 常见坑

- Windows 源码默认 GBK：编译必须带 `-encoding UTF-8`，否则中文乱码。
- `Scanner.nextInt()` 后接 `nextLine()` 会吞换行，混用要补一次 `nextLine()`。
- 整数除法向零取整，负数结果与 Python 的 `//` 不同，按题目验证。
