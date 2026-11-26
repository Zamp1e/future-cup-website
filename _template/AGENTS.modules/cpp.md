# 模块：C++ / 命令行工程

> 仅当 PROFILE「技术栈」含 C/C++ 时使用。未启用时不要读本文件，更不要把内容写进生成物。

## 目录

- 目录划分按 PROFILE「组织方式」（默认每实验一个 ASCII 子目录，如 `lab1/`）。
- 子目录内：源码 + 构建脚本（`build.bat` / `Makefile` / `build.sh`，按平台选）+ `README.md`。

## 编译

- 固定开警告：`g++ -std=c++17 -O2 -Wall -Wextra -o <exe> <src...>`。
- 标准按题目要求，题目没写默认 C++17。
- 警告不清零不算通过。

## 代码约束

- 库的使用**先确认**：题目是否允许第三方库，答案写进 PROFILE「硬约束」。题目没说明时按默认只用标准库（`<iostream> <vector> <string> <algorithm> <cmath> <iomanip> <fstream>`）。
- 同一程序内不混用 `printf/scanf` 与 `iostream`。
- `using namespace std;` 只写在 `.cpp` 里，不进头文件。

## 输入输出

- 输出**逐字对齐**题目样例：空格、数量、小数位、换行都要一致。
- 浮点用 `std::fixed << std::setprecision(n)`。
- 多组输入按题目约定：`cin >> T` 或读到 EOF（`while (std::cin >> x)`）。
- 大数据量时 `std::ios::sync_with_stdio(false)`。

## 边界与注释

- 空输入、0、负数、超范围在代码里显式处理，不静默出错。
- 中文注释只写算法思路与边界处理，不逐行翻译代码。

## 流程

1. 有样例时先列"输入 → 期望输出"表。
2. 再写实现，写完先跑样例，对齐后才谈提交。
