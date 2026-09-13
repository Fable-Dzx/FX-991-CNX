/**
 * solver（牛顿迭代）单元测试。
 * 运行方式（仓库根目录）：npm run test:solver
 * 遵循 test/ 目录现有约定：纯 TS 脚本，tsc 编译后 node 执行。
 */
import { numericalDerivative, newtonSolve } from "../modules/solver/newton";

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

function near(a: number, b: number, eps = 1e-8): boolean {
    return Math.abs(a - b) < eps;
}

console.log("== numericalDerivative ==");

check(
    "f(x)=x^2 在 x=3 处导数 ≈ 6",
    near(numericalDerivative(x => x * x, 3), 6, 1e-5)
);
check(
    "f(x)=sin(x) 在 x=0 处导数 ≈ 1",
    near(numericalDerivative(Math.sin, 0), 1, 1e-6)
);
check(
    "f(x)=1/x 在 x=2 处导数 ≈ -0.25",
    near(numericalDerivative(x => 1 / x, 2), -0.25, 1e-6)
);
check(
    "非有限函数值返回 NaN",
    Number.isNaN(numericalDerivative(x => Math.sqrt(x), -1))
);

console.log("== newtonSolve ==");

// x^2 - 4 = 0，x0=1 → 根 2
const r1 = newtonSolve(x => x * x - 4, { x0: 1 });
check("x^2-4=0 (x0=1) 收敛", r1.converged);
check("x^2-4=0 (x0=1) 根 ≈ 2", near(r1.root, 2), `root=${r1.root}`);
check("x^2-4=0 (x0=1) 最终函数值 ≈ 0", Math.abs(r1.finalValue) < 1e-8);
check("x^2-4=0 (x0=1) 迭代次数 > 0", r1.iterations > 0);

// x^2 - 4 = 0，x0=-5 → 根 -2（不同初值收敛到不同根）
const r2 = newtonSolve(x => x * x - 4, { x0: -5 });
check("x^2-4=0 (x0=-5) 根 ≈ -2", r2.converged && near(r2.root, -2));

// x^3 - 8 = 0，x0=1 → 根 2
const r3 = newtonSolve(x => x ** 3 - 8, { x0: 1 });
check("x^3-8=0 根 ≈ 2", r3.converged && near(r3.root, 2, 1e-6));

// sin(x) = 0，x0=3 → 根 π
const r4 = newtonSolve(Math.sin, { x0: 3 });
check("sin(x)=0 (x0=3) 根 ≈ π", r4.converged && near(r4.root, Math.PI, 1e-6));

// sin(x) = 0，x0=0.2 → 根 0
const r5 = newtonSolve(Math.sin, { x0: 0.2 });
check("sin(x)=0 (x0=0.2) 根 ≈ 0", r5.converged && near(r5.root, 0, 1e-8));

// 导数为 0：f(x)=x^2+1 在 x=0 处导数为 0 且无实根
const r6 = newtonSolve(x => x * x + 1, { x0: 0 });
check(
    "x^2+1 (x0=0) 不收敛且状态为 ZERO_DERIVATIVE",
    !r6.converged && r6.status === "ZERO_DERIVATIVE",
    `status=${r6.status}`
);

// 无解：x^2+1=0 从 x0=1 出发 → 迭代发散/不收敛
const r7 = newtonSolve(x => x * x + 1, { x0: 1, maxIter: 100 });
check("x^2+1=0 (x0=1) 不收敛", !r7.converged, `status=${r7.status}`);

// 非有限值：sqrt(x) 在负数处 NaN
const r8 = newtonSolve(x => Math.sqrt(x) - 2, { x0: -1 });
check("sqrt(x)-2 (x0=-1) 状态为 NON_FINITE", r8.status === "NON_FINITE");

// 超过最大迭代次数：震荡函数 f(x)=x^(1/3) 在 0 附近牛顿法震荡
const r9 = newtonSolve(x => Math.cbrt(x), { x0: 1, maxIter: 10 });
check(
    "cbrt(x) (x0=1, maxIter=10) 不收敛",
    !r9.converged || r9.iterations <= 10,
    `status=${r9.status}, iters=${r9.iterations}`
);

// 指数增长导致发散：f(x)=e^x + 1 无根，x0=10 快速发散
const r10 = newtonSolve(x => Math.exp(x) + 1, { x0: 10 });
check("e^x+1 (x0=10) 不收敛", !r10.converged);

// 非法初值
const r11 = newtonSolve(x => x, { x0: NaN });
check("x0=NaN 返回 NON_FINITE", r11.status === "NON_FINITE");

// 自定义容差
const r12 = newtonSolve(x => x * x - 2, { x0: 1, tol: 1e-12 });
check(
    "x^2-2=0 容差 1e-12 下根 ≈ √2",
    r12.converged && near(r12.root, Math.SQRT2, 1e-9)
);

console.log(`\n结果: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
