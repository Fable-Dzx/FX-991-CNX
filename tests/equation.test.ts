/**
 * 方程解析器（modules/solver/equation.ts + fx991/solve.ts 粘合层）单元测试。
 * 运行：npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    compileEquation as compileEqCore,
    collectVariables,
    EquationError
} from "../modules/solver/equation";
import {
    compileEquation,
    solveByNewton,
    SolveSyntaxError
} from "../modules/fx991/solve";

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

/* ---------------- 粘合层（对外 API） ---------------- */

test("粘合层：科学计数法 1e-3 解析", () => {
    const f = compileEquation("x - 1e-3 = 0");
    assert.ok(near(f.eval(1e-3), 0));
    const r = solveByNewton(f.eval, { guess: 0 });
    assert.equal(r.converged, true);
    assert.ok(near(r.root, 1e-3, 1e-9));
});

test("粘合层：科学计数法 2.5E10 解析", () => {
    const f = compileEquation("x - 2.5E10 = 0");
    assert.ok(near(f.eval(2.5e10), 0, 1e-3));
});

test("粘合层：全角符号 → SolveSyntaxError 且提示使用半角", () => {
    assert.throws(() => compileEquation("ｘ＋１＝０"), SolveSyntaxError);
    try {
        compileEquation("x＋1 = 0");
        assert.fail("should throw");
    } catch (e) {
        assert.ok((e as Error).message.includes("全角"));
    }
});

test("粘合层：多变量 → SolveSyntaxError", () => {
    assert.throws(() => compileEquation("x + y + z = 0"), SolveSyntaxError);
});

test("粘合层：非法标识符（多字母）→ SolveSyntaxError", () => {
    assert.throws(() => compileEquation("xx = 1"), SolveSyntaxError);
});

test("粘合层：未知函数 → SolveSyntaxError", () => {
    assert.throws(() => compileEquation("foo(x) = 1"), SolveSyntaxError);
});

test("粘合层：空方程 → SolveSyntaxError", () => {
    assert.throws(() => compileEquation("   "), SolveSyntaxError);
});

test("粘合层：等号数量过多 → SolveSyntaxError", () => {
    assert.throws(() => compileEquation("x = 1 = 2"), SolveSyntaxError);
});

test("粘合层：无变量默认 x", () => {
    const f = compileEquation("3 - 3 = 0");
    assert.equal(f.variable, "x");
    assert.ok(near(f.eval(0), 0));
});

test("粘合层：单字母变量自动检测（t 与 z）", () => {
    const ft = compileEquation("t^2 - 9 = 0");
    assert.equal(ft.variable, "t");
    assert.ok(near(ft.eval(3), 0));
    const fz = compileEquation("z - 5 = 0");
    assert.equal(fz.variable, "z");
    assert.ok(near(fz.eval(5), 0));
});

test("粘合层：DEG 角度单位下 sin 方程按度求值", () => {
    // sin(x) - 0.5 = 0，DEG 模式 → x = 30
    const f = compileEquation("sin(x) - 0.5 = 0", "DEG");
    const r = solveByNewton(f.eval, { guess: 20 });
    assert.equal(r.converged, true);
    assert.ok(near(r.root, 30, 1e-4));
});

test("粘合层：RAD 角度单位下 sin 方程按弧度求值", () => {
    const f = compileEquation("sin(x) - 0.5 = 0", "RAD");
    const r = solveByNewton(f.eval, { guess: 0.5 });
    assert.equal(r.converged, true);
    assert.ok(near(r.root, Math.PI / 6, 1e-4));
});

/* ---------------- 解析器核心层（solver/equation） ---------------- */

test("核心层：compileEquation 指定变量与角度单位", () => {
    const f = compileEqCore("y = sin(30)", "y", "DEG");
    assert.ok(near(f(0.5), 0, 1e-9));
});

test("核心层：collectVariables 收集变量集合", () => {
    assert.deepEqual(
        Array.from(collectVariables("x + y - z = 0")).sort(),
        ["x", "y", "z"].sort()
    );
    assert.equal(collectVariables("2x = 8").size, 1);
    assert.deepEqual(Array.from(collectVariables("3 = 0")), []);
});

test("核心层：常数 e 不可作变量，pi 可作常数", () => {
    assert.throws(() => compileEqCore("e = 1", "e"), EquationError);
    const f = compileEqCore("x - pi = 0", "x");
    assert.ok(near(f(Math.PI), 0));
});

test("核心层：多余右括号 → EquationError", () => {
    assert.throws(() => compileEqCore("x) = 1", "x"), EquationError);
});

test("核心层：缺少右括号 → EquationError", () => {
    assert.throws(() => compileEqCore("(x = 1", "x"), EquationError);
});

test("核心层：函数缺括号 → EquationError", () => {
    assert.throws(() => compileEqCore("sin x = 0", "x"), EquationError);
});
