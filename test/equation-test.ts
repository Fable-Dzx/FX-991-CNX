/**
 * equation（方程解析/编译）与 solveEquation（一键求解）单元测试。
 * 运行方式（仓库根目录）：npm run test:solver
 */
import { compileEquation, EquationError } from "../modules/solver/equation";
import { solveEquation } from "../modules/fx991/solve";

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

function expectThrow(name: string, fn: () => unknown) {
    try {
        fn();
        check(name, false, "预期抛出异常但未抛出");
    } catch (e) {
        check(name, e instanceof EquationError, `actual: ${e}`);
    }
}

console.log("== compileEquation 基础求值 ==");

const c1 = compileEquation("2+3*4");
check("2+3*4 = 14", c1(0) === 14);

const c2 = compileEquation("(2+3)*4");
check("(2+3)*4 = 20", c2(0) === 20);

const c3 = compileEquation("2^3^2");
check("2^3^2 = 512（右结合）", c3(0) === 512);

const c4 = compileEquation("-2^2");
check("-2^2 = -4（一元负号优先级低于 ^）", c4(0) === -4);

const c5 = compileEquation("x^2 - 4");
check("x^2-4 在 x=3 处 = 5", c5(3) === 5);

const c6 = compileEquation("2x + 1");
check("隐式乘法 2x+1 在 x=3 处 = 7", c6(3) === 7);

const c7 = compileEquation("3(x+1)");
check("隐式乘法 3(x+1) 在 x=2 处 = 9", c7(2) === 9);

const c8 = compileEquation("2pi");
check("常数 2pi ≈ 6.283", near(c8(0), 2 * Math.PI));

const c9 = compileEquation("e^x");
check("e^1 ≈ 2.718", near(c9(1), Math.E, 1e-12));

const c10 = compileEquation("1.5e-2 + 0.5");
check("科学计数 1.5e-2+0.5 = 0.515", near(c10(0), 0.515));

const c11 = compileEquation("sqrt(abs(-9)) + ln(e) + log(100)");
check("sqrt(abs(-9))+ln(e)+log(100) = 6", near(c11(0), 6));

console.log("== compileEquation 函数与角度单位 ==");

const c12 = compileEquation("sin(x)", "x", "RAD");
check("sin(pi/2) = 1（RAD）", near(c12(Math.PI / 2), 1));

const c13 = compileEquation("sin(x)", "x", "DEG");
check("sin(90) = 1（DEG）", near(c13(90), 1));

const c14 = compileEquation("sin(x)", "x", "GRA");
check("sin(100) = 1（GRA）", near(c14(100), 1));

const c15 = compileEquation("asin(x)", "x", "DEG");
check("asin(1) = 90（DEG）", near(c15(1), 90));

const c16 = compileEquation("atan(1)*4", "x", "RAD");
check("atan(1)*4 ≈ π", near(c16(0), Math.PI));

console.log("== compileEquation 等号移项 ==");

const c17 = compileEquation("x^2 - 4 = 0");
check("x^2-4=0 移项后在 x=2 处 = 0", near(c17(2), 0));
check("x^2-4=0 移项后在 x=3 处 = 5", near(c17(3), 5));

const c18 = compileEquation("2x + 1 = x - 3");
check("2x+1=x-3 移项后在 x=-4 处 = 0", near(c18(-4), 0));

console.log("== compileEquation 安全白名单 ==");

expectThrow("拒绝 process.exit", () => compileEquation("process.exit(1)"));
expectThrow("拒绝 require", () => compileEquation("require('fs')"));
expectThrow("拒绝 window", () => compileEquation("window.location"));
expectThrow("拒绝未知函数 foo(x)", () => compileEquation("foo(x)"));
expectThrow("拒绝多字母标识符 xx", () => compileEquation("xx + 1"));
expectThrow("拒绝非法字符 @", () => compileEquation("x @ 2"));
expectThrow("拒绝全角括号", () => compileEquation("（x+1）"));
expectThrow("拒绝多余右括号", () => compileEquation("x+1)"));
expectThrow("拒绝缺少右括号", () => compileEquation("(x+1"));
expectThrow("拒绝函数缺括号 sinx", () => compileEquation("sinx"));
expectThrow("拒绝双等号", () => compileEquation("x = 1 = 2"));
expectThrow("拒绝空方程", () => compileEquation("   "));
expectThrow("拒绝自由变量 y（求解变量为 x）", () =>
    compileEquation("x + y = 0", "x")
);
expectThrow("拒绝非法变量名", () => compileEquation("x", "foo"));

// 白名单内的都不应抛异常
const okCases = [
    "x", "1", "-x", "x/2", "2^-x",
    "sin(x)+cos(x)", "tan(x)", "asin(0.5)", "acos(0.5)", "atan(x)",
    "log(x)", "ln(x)", "sqrt(x)", "abs(x)", "exp(x)", "pi", "e",
    "X^2-4" // 大小写不敏感
];
let allOk = true;
for (const src of okCases) {
    try {
        compileEquation(src);
    } catch (e) {
        allOk = false;
        console.log(`    意外失败: "${src}" -> ${(e as Error).message}`);
    }
}
check("白名单用例全部编译通过", allOk);

// 变量名可指定为 y
const c19 = compileEquation("y^2 = 9", "y");
check("变量 y：y^2=9 在 y=3 处 = 0", near(c19(3), 0));

console.log("== solveEquation 端到端 ==");

const s1 = solveEquation("x^2 - 4 = 0", "x", 1);
check(
    "x^2-4=0 (guess=1) → x=2",
    s1.ok && s1.converged && near(s1.root, 2),
    JSON.stringify(s1)
);

const s2 = solveEquation("sin(x) = 0", "x", 3);
check(
    "sin(x)=0 (guess=3) → x=π",
    s2.ok && s2.converged && near(s2.root, Math.PI, 1e-6)
);

const s3 = solveEquation("x^3 - 8 = 0", "x", 1);
check(
    "x^3-8=0 (guess=1) → x=2",
    s3.ok && s3.converged && near(s3.root, 2, 1e-6)
);

const s4 = solveEquation("x^2 + 1 = 0", "x", 1);
check("x^2+1=0 无实解 → 不收敛", s4.ok && !s4.converged);

const s5 = solveEquation("x^2 + 1", "x", 0);
check(
    "x^2+1 (guess=0) 导数为 0",
    s5.ok && !s5.converged && s5.status === "ZERO_DERIVATIVE",
    JSON.stringify(s5)
);

const s6 = solveEquation("exp(x) - 3 = 0", "x", 0);
check(
    "e^x-3=0 → x=ln3",
    s6.ok && s6.converged && near(s6.root, Math.log(3), 1e-6)
);

const s7 = solveEquation("sin(x) = 0", "x", 80, "D");
// DEG 模式下 sin(x°)=0 的根是 180 的整数倍
const s7rem = s7.ok ? Math.abs(((s7.root % 180) + 180) % 180) : NaN;
check(
    "sin(x)=0 DEG 模式 (guess=80°) → 根为 180 的整数倍",
    s7.ok && s7.converged && (s7rem < 1e-3 || s7rem > 180 - 1e-3),
    JSON.stringify(s7)
);

const s8 = solveEquation("bad input ##", "x", 0);
check("非法输入返回 ok=false 与错误信息", !s8.ok && s8.error.length > 0);

const s9 = solveEquation("2 = 4", "x", 0);
check("无变量方程 2=4 → 不收敛或错误", !s9.ok || (s9.ok && !s9.converged));

const s10 = solveEquation("x^2 - 4 = 0", "x", NaN);
check("NaN 初值返回 ok=false", !s10.ok);

console.log(`\n结果: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
