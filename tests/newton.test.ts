/**
 * 牛顿求解器（modules/solver/newton.ts）单元测试：状态分类 + 鲁棒性。
 * 运行：npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    newtonSolve,
    numericalDerivative,
    NewtonStatus
} from "../modules/solver/newton";

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

const expectStatus = (
    r: { status: NewtonStatus },
    s: NewtonStatus
) => assert.equal(r.status, s);

test("numericalDerivative: x² 在 3 处导数 ≈ 6", () => {
    const d = numericalDerivative(x => x * x, 3);
    assert.ok(near(d, 6, 1e-4));
});

test("numericalDerivative: sin 在 0 处导数 ≈ 1", () => {
    const d = numericalDerivative(Math.sin, 0);
    assert.ok(near(d, 1, 1e-4));
});

test("x² - 4, x0=1 → CONVERGED, root≈2", () => {
    const r = newtonSolve(x => x * x - 4, { x0: 1 });
    expectStatus(r, "CONVERGED");
    assert.ok(near(r.root, 2));
    assert.ok(near(r.finalValue, 0, 1e-6));
    assert.equal(r.converged, true);
});

test("x² - 4, x0=0（驻点）→ 扰动后仍 CONVERGED", () => {
    const r = newtonSolve(x => x * x - 4, { x0: 0 });
    expectStatus(r, "CONVERGED");
    assert.ok(near(Math.abs(r.root), 2));
});

test("常数函数 3, x0=0 → ZERO_DERIVATIVE（扰动耗尽）", () => {
    const r = newtonSolve(() => 3, { x0: 0 });
    expectStatus(r, "ZERO_DERIVATIVE");
    assert.equal(r.converged, false);
});

test("x² + 1（无实根）→ 不收敛", () => {
    const r = newtonSolve(x => x * x + 1, { x0: 0 });
    assert.equal(r.converged, false);
    assert.notEqual(r.status, "CONVERGED");
});

test("sqrt(x) = 2, x0=1 → CONVERGED, root≈4", () => {
    const r = newtonSolve(x => Math.sqrt(x) - 2, { x0: 1 });
    expectStatus(r, "CONVERGED");
    assert.ok(near(r.root, 4));
});

test("log(x) = 2, x0=50 → CONVERGED, root≈100", () => {
    const r = newtonSolve(x => Math.log10(x) - 2, { x0: 50 });
    expectStatus(r, "CONVERGED");
    assert.ok(near(r.root, 100, 1e-4));
});

test("sqrt 负数 → NON_FINITE", () => {
    const r = newtonSolve(x => Math.sqrt(x - 10), { x0: 1 });
    expectStatus(r, "NON_FINITE");
    assert.equal(r.converged, false);
});

test("log 非正数 → NON_FINITE", () => {
    const r = newtonSolve(x => Math.log(x), { x0: -1 });
    expectStatus(r, "NON_FINITE");
    assert.equal(r.converged, false);
});

test("非有限初始猜测 → NON_FINITE, iterations=0", () => {
    const r = newtonSolve(x => x, { x0: Number.NaN });
    expectStatus(r, "NON_FINITE");
    assert.equal(r.iterations, 0);
});

test("maxIter=5 不足以收敛 → MAX_ITER_REACHED", () => {
    const r = newtonSolve(x => x * x - 4, { x0: 1e6, maxIter: 5 });
    expectStatus(r, "MAX_ITER_REACHED");
    assert.equal(r.iterations, 5);
    assert.equal(r.converged, false);
});

test("发散保护：极大初值快速发散 → 状态非 CONVERGED", () => {
    const r = newtonSolve(x => x * x - 4, { x0: 1e15, maxIter: 50 });
    assert.equal(r.converged, false);
    assert.ok(["DIVERGED", "NON_FINITE", "MAX_ITER_REACHED"].includes(r.status));
});

test("严格单调：阻尼牛顿保证 |f| 不振荡上升（初值远离根）", () => {
    const r = newtonSolve(x => Math.pow(x, 3) - 8, { x0: 100 });
    assert.equal(r.converged, true);
    assert.ok(near(r.root, 2, 1e-4));
});

test("sin(x) = 0, x0=3 → CONVERGED, root≈π", () => {
    const r = newtonSolve(Math.sin, { x0: 3 });
    expectStatus(r, "CONVERGED");
    assert.ok(near(r.root, Math.PI, 1e-4));
});

test("tol 收紧：x²-4 tol=1e-12 精度更高", () => {
    const r = newtonSolve(x => x * x - 4, { x0: 1, tol: 1e-12 });
    expectStatus(r, "CONVERGED");
    assert.ok(near(r.root, 2, 1e-10));
});
