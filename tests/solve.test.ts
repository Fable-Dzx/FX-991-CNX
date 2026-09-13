/**
 * SOLVE 引擎单元测试（Node 内置 test runner + tsc 编译，零新依赖）。
 * 运行：npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    compileEquation,
    solveByNewton,
    SolveSyntaxError,
    formatRoot
} from "../modules/fx991/solve";

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

test("x^2 - 4 = 0, guess 1 → root ≈ 2", () => {
    const f = compileEquation("x^2 - 4 = 0");
    assert.equal(f.variable, "x");
    assert.ok(near(f.eval(2), 0));
    const r = solveByNewton(f.eval, { guess: 1 });
    assert.equal(r.converged, true);
    assert.ok(near(r.root, 2));
    assert.ok(near(r.fVal, 0, 1e-6));
});

test("x^2 - 4 = 0, guess -1 → root ≈ -2（多解需换初值）", () => {
    const f = compileEquation("x^2 - 4 = 0");
    const r = solveByNewton(f.eval, { guess: -1 });
    assert.equal(r.converged, true);
    assert.ok(near(r.root, -2));
});

test("x^2 - 4 = 0, 默认初值 0（驻点）→ 扰动后仍收敛", () => {
    const f = compileEquation("x^2 - 4 = 0");
    const r = solveByNewton(f.eval, { guess: 0 });
    assert.equal(r.converged, true);
    assert.ok(near(Math.abs(r.root), 2));
});

test("sin(x) = 2（无解）→ 不收敛", () => {
    const f = compileEquation("sin(x) = 2");
    const r = solveByNewton(f.eval, { guess: 0 });
    assert.equal(r.converged, false);
});

test("sin(x) = 0, guess 3 → root ≈ π", () => {
    const f = compileEquation("sin(x) = 0");
    const r = solveByNewton(f.eval, { guess: 3 });
    assert.equal(r.converged, true);
    assert.ok(near(r.root, Math.PI));
});

test("sin(x) = 0, guess 1 → root ≈ 0（收敛到最近驻点）", () => {
    const f = compileEquation("sin(x) = 0");
    const r = solveByNewton(f.eval, { guess: 1 });
    assert.equal(r.converged, true);
    assert.ok(near(r.root, 0));
});

test("x^3 - 8 = 0, guess 1 → root ≈ 2", () => {
    const f = compileEquation("x^3 - 8 = 0");
    const r = solveByNewton(f.eval, { guess: 1 });
    assert.equal(r.converged, true);
    assert.ok(near(r.root, 2));
});

test("sin(x) = 0.5 → root ≈ π/6", () => {
    const f = compileEquation("sin(x) - 0.5 = 0");
    const r = solveByNewton(f.eval, { guess: 0.5 });
    assert.equal(r.converged, true);
    assert.ok(near(r.root, Math.PI / 6));
});

test("无实根 x^2 + 1 = 0 不收敛", () => {
    const f = compileEquation("x^2 + 1 = 0");
    const r = solveByNewton(f.eval, { guess: 0 });
    assert.equal(r.converged, false);
});

test("常函数（导数为 0）→ 报导数异常", () => {
    const f = compileEquation("3 = 0");
    const r = solveByNewton(f.eval, { guess: 0 });
    assert.equal(r.converged, false);
    assert.ok((r.message || "").includes("Derivative"));
});

test("x^2 = 0, guess 0 → 直接命中根 0", () => {
    const f = compileEquation("x^2 = 0");
    const r = solveByNewton(f.eval, { guess: 0 });
    assert.equal(r.converged, true);
    assert.equal(r.root, 0);
});

test("非法符号 → SolveSyntaxError", () => {
    assert.throws(() => compileEquation("x^2 + @ = 0"), SolveSyntaxError);
});

test("多变量 → SolveSyntaxError", () => {
    assert.throws(() => compileEquation("x + y = 0"), SolveSyntaxError);
});

test("两个等号 → SolveSyntaxError", () => {
    assert.throws(() => compileEquation("x = 1 = 2"), SolveSyntaxError);
});

test("隐式乘法 2x = 8 → root ≈ 4", () => {
    const f = compileEquation("2x = 8");
    assert.ok(near(f.eval(4), 0));
    const r = solveByNewton(f.eval, { guess: 1 });
    assert.equal(r.converged, true);
    assert.ok(near(r.root, 4));
});

test("等号移项 x^2 = 4 → root ≈ 2", () => {
    const f = compileEquation("x^2 = 4");
    const r = solveByNewton(f.eval, { guess: 1 });
    assert.ok(near(r.root, 2));
});

test("无等号视为 f(x)=0：x^2-9 → root ≈ 3", () => {
    const f = compileEquation("x^2 - 9");
    const r = solveByNewton(f.eval, { guess: 1 });
    assert.ok(near(r.root, 3));
});

test("变量 y：y^2 = 9 → variable=y, root ≈ 3", () => {
    const f = compileEquation("y^2 = 9");
    assert.equal(f.variable, "y");
    const r = solveByNewton(f.eval, { guess: 1 });
    assert.ok(near(r.root, 3));
});

test("常数 pi 与 e", () => {
    const f = compileEquation("x = pi");
    assert.ok(near(f.eval(Math.PI), 0));
    const g = compileEquation("x = e");
    assert.ok(near(g.eval(Math.E), 0));
});

test("函数与括号：sqrt(x) = 2 → root ≈ 4", () => {
    const f = compileEquation("sqrt(x) = 2");
    const r = solveByNewton(f.eval, { guess: 1 });
    assert.ok(near(r.root, 4));
});

test("log/ln/abs/exp 求值", () => {
    const f = compileEquation("log(x) = 2");
    assert.ok(near(f.eval(100), 0));
    const g = compileEquation("ln(x) = 1");
    assert.ok(near(g.eval(Math.E), 0));
    const h = compileEquation("abs(x) - 3 = 0");
    assert.ok(near(h.eval(3), 0));
    const k = compileEquation("exp(x) = 1");
    assert.ok(near(k.eval(0), 0));
});

test("formatRoot 格式化", () => {
    assert.equal(formatRoot(0), "0");
    assert.equal(formatRoot(2), "2");
    assert.equal(formatRoot(1.4142135623), "1.4142135623");
    assert.equal(formatRoot(Number.NaN), "ERROR");
});

test("maxIter 上限触发", () => {
    const f = compileEquation("x^2 - 4 = 0");
    const r = solveByNewton(f.eval, { guess: 1, maxIter: 2 });
    // 2 次迭代通常不足以收敛到 1e-9
    assert.ok(r.iterations <= 2);
});
