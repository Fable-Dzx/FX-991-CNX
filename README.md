# FX-991CN X 在线科学计算器

卡西欧 fx-991CN X（CLASSWIZ 深灰机身）风格的网页版科学计算器。
基于 Next.js + MobX + TypeScript，静态导出后部署于 GitHub Pages。

在线地址：<https://fable-dzx.github.io/FX-991-CNX/>

## 功能

- **COMP** 基础计算：四则运算、函数（sin/cos/tan、√、x²、x³、^、log、ln、10ˣ、eˣ、nPr/nCr、x!、分数 d/c、°′″）、Pol/Rec、M+/M-、STO/RCL 变量存储、SHIFT+• = Ran#、SHIFT+10ˣ = π、**ENG 工程计数**（结果页按 ENG 键切换 ×10³ⁿ 显示，再按指数 +3）
- **CMPLX** 复数：a+bi 输入、SHIFT+ENG 极坐标切换、Re(/Im(/conjg(/arg(/Abs（SHIFT+1~5）
- **BASE-N** 进制：DEC/BIN/OCT/HEX 循环切换（°′″ 键）、AND/OR/XOR/XNOR/NOT（SHIFT+1~5）、负数以补码显示
- **EQN** 方程：一元二次（含**复数根**）、一元三次（卡尔丹公式）、二元/三元一次方程组；**(-) 键支持负系数**
- **STAT** 统计：
  - 1-VAR：n / x̄ / σx / sx / Σx / Σx²（SHIFT+1 查看）
  - 2-VAR：双变量线性回归 y = a + b x，输出 **a / b / r 相关系数**；先输 x 按 =，再输 y 按 = 录入一组
- **像素液晶屏**：屏幕输出使用点阵像素字体（5×7 dot-matrix，`fonts/dotgothic16-latin.woff2`）+ LCD 点阵网格纹理，复刻真机 fx-991CN X 的像素显示观感
- **结果复制**：点击屏幕结果区复制到剪贴板（显示 COPIED 提示）
- **计算历史**：↑ / ↓ 键翻看历史算式
- **PWA**：可离线运行（`public/manifest.json` + `public/sw.js`）
- PC 键盘完整映射（见下）、安卓触控适配、横屏小屏适配

## 键盘映射

| 按键 | 功能 |
| --- | --- |
| `0-9` `.` | 数字 / 小数点（`SHIFT+数字` 进入模式功能） |
| `+ - * /` `Enter`/`=` | 运算符 / 等号 |
| `Backspace` `Delete` | 退格 / AC |
| `Insert` `Esc` | SHIFT / 退出菜单 |
| `↑ ↓ ← →` | 历史 / 光标 |
| `Home` `End` | 光标到首 / 尾 |
| `a-f` `x y m p h s` | ALPHA 变量 / 函数快捷输入 |

## 本地运行

```bash
npm install
npm run dev      # 开发调试 → http://localhost:3000/FX-991-CNX/
npm run build    # 静态导出 → out/ 目录
```

Windows PowerShell 若报 `npm.ps1 禁止运行脚本`，改用 CMD 终端执行，或
`Set-ExecutionPolicy -Scope Process Bypass`。

## 部署要点

- `next.config.js`：`output: 'export'`、`basePath: '/FX-991-CNX'`、`assetPrefix: '/FX-991-CNX'`、`images.unoptimized: true`、`trailingSlash: true`
- `public/.nojekyll` 必须存在（跳过 Jekyll 处理）
- GitHub Pages 部署源选择 **GitHub Actions**，推送 `main` 自动触发部署，等待 2-4 分钟，浏览器需清除缓存查看效果

## 分支与备份

`main` 为发布主线。所有重大改动前均创建对应 `backup/<日期>-<desc>` 分支与 tag 并推送，可随时回滚。

## 历史迭代

1. PC 键盘事件（阻止浏览器默认行为、快捷键、Esc 退出菜单）
2. 安卓移动端适配（viewport、触控、刘海安全区、横屏兼容）
3. 功能升级：CMPLX / BASE-N / EQN / STAT 四大模式
4. UI 改版：CLASSWIZ 深灰机身、CASIO 品牌条、淡绿液晶屏幕
5. 仓库重命名 FX-991-CNX；GitHub Actions 升级至 Node 24
6. basePath 修复，Pages 部署 404 解决
7. 功能完善：EQN 负号修复、STAT 双变量回归、ENG 工程计数、结果复制、PWA、像素液晶屏

## 致谢

- **原作者**：[ErnestThePoet](https://github.com/ErnestThePoet/ec-82-ms) —— 开源项目「EC-82MS 在线科学计算器」（MIT 许可），本项目的计算内核与基础界面源自该作品。
- **改编作者**：[Fable-Dzx](https://github.com/Fable-Dzx/FX-991-CNX) —— 在原作者作品基础上完成 FX-991CN X 化改造：四大模式（CMPLX / BASE-N / EQN / STAT）、CLASSWIZ 深灰机身 UI、像素液晶屏、PWA 离线支持、移动端适配等。
- **AI 辅助生成**：本项目开发过程中使用豆包（Doubao）进行代码生成、功能扩展、调试与文档整理等辅助工作。

核心实现思路另参考：<https://zhuanlan.zhihu.com/p/596644979>
