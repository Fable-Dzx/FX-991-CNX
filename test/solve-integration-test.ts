/**
 * SOLVE 功能集成测试：驱动 MobX store 与按键逻辑，
 * 模拟用户完整操作流：MODE 菜单选 4（EQN）→ 按 5（SOLVE）→
 * 输入方程/变量/初值 → 求解 → 检查 store 状态与屏幕行。
 * 运行方式：npm run test:solver（包含在编译清单中时）或单独编译执行。
 */

// Node 环境下补齐浏览器 API（calculator-state / strings-res 可能用到）
const g = globalThis as Record<string, unknown>;
if (!g.localStorage) {
    const store: Record<string, string> = {};
    g.localStorage = {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
            store[k] = String(v);
        },
        removeItem: (k: string) => {
            delete store[k];
        }
    };
}

import fx from "../observables/fx991-state";
import * as FX from "../logics/fx991";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string) {
    if (cond) {
        passed++;
        console.log(`  PASS  ${name}`);
    } else {
        failed++;
        console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
    }
}

// 1. 进入 EQN 模式
FX.onModeMenuSelect("4");
check("MODE 4 进入 EQN", fx.mode === "EQN");

// 2. 菜单行包含第 5 项 SOLVE
const menu = FX.fxScreenLines();
check(
    "EQN 菜单含 5:SOLVE f(x)=0",
    menu.some(l => l.includes("5:SOLVE")),
    menu.join(" | ")
);

// 3. 按 5 选择 SOLVE 类型
FX.onDigit("5");
check("按 5 后 eqnType=SOLVE", fx.eqnType === "SOLVE");

// 4. 物理数字键不应污染系数缓冲
FX.onDigit("9");
FX.onDot();
FX.onNegate();
check("SOLVE 状态下物理键不写入系数", fx.eqnCoeffs.length === 0 && fx.eqnCur === "");

// 5. 输入方程并求解 x^2-4=0，初值 1
fx.solveSetEqn("x^2 - 4 = 0");
fx.solveSetVar("x");
fx.solveSetGuess("1");
fx.solveRun("R");
const r1 = fx.solveResult;
check(
    "solveRun 求出根 2",
    r1 !== null && r1.ok && r1.converged && Math.abs(r1.root - 2) < 1e-8,
    JSON.stringify(r1)
);

// 6. 不收敛场景：x^2+1=0
fx.solveSetEqn("x^2 + 1 = 0");
fx.solveRun("R");
const r2 = fx.solveResult;
check(
    "x^2+1=0 返回未收敛",
    r2 !== null && r2.ok && !r2.converged
);

// 7. 解析错误场景
fx.solveSetEqn("foo(x) = 1");
fx.solveRun("R");
const r3 = fx.solveResult;
check("白名单外函数返回 ok=false", r3 !== null && !r3.ok);

// 8. AC 清空 SOLVE 状态
FX.onAc();
check(
    "AC 清空 SOLVE",
    fx.solveEqn === "" && fx.solveResult === null && fx.solveVar === "x"
);

// 9. 原有 EQN 流程不受影响：重进 EQN 选 1（QUAD）解 x²-5x+6=0
fx.setMode("EQN");
FX.onDigit("1");
check("QUAD 类型选择正常", fx.eqnType === "QUAD");
fx.eqnAppendDigit("1");
fx.eqnEnter();
fx.eqnAppendDigit("-");
fx.eqnAppendDigit("5");
fx.eqnEnter();
fx.eqnAppendDigit("6");
fx.eqnEnter();
check(
    "QUAD 求解 x²-5x+6=0 → 3 与 2",
    fx.eqnResult !== null &&
        fx.eqnResult.roots.length === 2 &&
        fx.eqnResult.roots.includes("3") &&
        fx.eqnResult.roots.includes("2"),
    JSON.stringify(fx.eqnResult)
);

// 10. 切换模式后 SOLVE 字段被重置
fx.setMode("COMP");
check("setMode 重置 SOLVE 状态", fx.solveEqn === "" && fx.eqnType === null);

console.log(`\n结果: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
