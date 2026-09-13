/**
 * 牛顿迭代法数值求解器（SOLVE 功能核心）。
 * 纯 TypeScript 实现，无任何外部依赖，可直接在浏览器 / Node / API Route 中复用。
 *
 * 设计要点：
 * - 导数使用中心差分近似，避免解析求导；
 * - 结果显式区分收敛 / 不收敛的各种原因（导数为 0、发散、超迭代上限、非有限值）；
 * - 不抛异常：所有失败情况通过 status 字段返回，方便 UI 层统一处理。
 */

/** 牛顿法终止 / 失败状态 */
export type NewtonStatus =
    /** 已收敛：|f(x)| 与步长均小于容差 */
    | "CONVERGED"
    /** 导数（近似）为 0，无法继续迭代 */
    | "ZERO_DERIVATIVE"
    /** 达到最大迭代次数仍未收敛 */
    | "MAX_ITER_REACHED"
    /** 迭代发散（|x| 或 |f(x)| 超过阈值） */
    | "DIVERGED"
    /** 计算过程中出现 NaN / Infinity（如 sqrt 负数、log 非正数） */
    | "NON_FINITE";

export interface NewtonOptions {
    /** 初始猜测值 */
    x0: number;
    /** 收敛容差，默认 1e-10 */
    tol?: number;
    /** 最大迭代次数，默认 50 */
    maxIter?: number;
    /** 中心差分步长比例因子，默认 1e-6 */
    diffH?: number;
}

export interface NewtonResult {
    /** 求得的根（未收敛时为最后一次迭代值） */
    root: number;
    /** 是否收敛 */
    converged: boolean;
    /** 实际迭代次数 */
    iterations: number;
    /** 最终函数值 f(root)，未收敛时可能为 NaN */
    finalValue: number;
    /** 状态码 */
    status: NewtonStatus;
}

/** 发散判定阈值：|x| 超过该值视为发散 */
const DIVERGE_BOUND = 1e12;

/**
 * 中心差分数值求导：f'(x) ≈ (f(x+h) - f(x-h)) / (2h)
 * h 随 |x| 缩放，兼顾大数量级与小数值的精度。
 */
export function numericalDerivative(
    f: (x: number) => number,
    x: number,
    hRatio: number = 1e-6
): number {
    const h = hRatio * Math.max(1, Math.abs(x));
    const fPlus = f(x + h);
    const fMinus = f(x - h);
    if (!Number.isFinite(fPlus) || !Number.isFinite(fMinus)) {
        return NaN;
    }
    return (fPlus - fMinus) / (2 * h);
}

/**
 * 牛顿迭代法求 f(x) = 0 的一个数值解。
 *
 * 迭代公式：x_{n+1} = x_n - f(x_n) / f'(x_n)
 * f'(x) 用中心差分近似。
 *
 * @param f       目标函数（已移项为 f(x)=0 形式）
 * @param options 初始猜测值 / 容差 / 最大迭代次数
 */
export function newtonSolve(
    f: (x: number) => number,
    options: NewtonOptions
): NewtonResult {
    const tol = options.tol ?? 1e-10;
    const maxIter = options.maxIter ?? 50;
    const diffH = options.diffH ?? 1e-6;

    let x = options.x0;
    if (!Number.isFinite(x)) {
        return {
            root: NaN,
            converged: false,
            iterations: 0,
            finalValue: NaN,
            status: "NON_FINITE"
        };
    }

    for (let i = 1; i <= maxIter; i++) {
        const fx = f(x);
        if (!Number.isFinite(fx)) {
            return {
                root: x,
                converged: false,
                iterations: i,
                finalValue: fx,
                status: "NON_FINITE"
            };
        }

        // 已经足够接近根
        if (Math.abs(fx) < tol) {
            return {
                root: x,
                converged: true,
                iterations: i,
                finalValue: fx,
                status: "CONVERGED"
            };
        }

        const dfx = numericalDerivative(f, x, diffH);
        if (!Number.isFinite(dfx)) {
            return {
                root: x,
                converged: false,
                iterations: i,
                finalValue: fx,
                status: "NON_FINITE"
            };
        }
        // 导数为 0（或数值上过小），牛顿法无法继续
        if (Math.abs(dfx) < 1e-14) {
            return {
                root: x,
                converged: false,
                iterations: i,
                finalValue: fx,
                status: "ZERO_DERIVATIVE"
            };
        }

        const step = fx / dfx;
        const next = x - step;

        if (!Number.isFinite(next) || Math.abs(next) > DIVERGE_BOUND) {
            return {
                root: next,
                converged: false,
                iterations: i,
                finalValue: fx,
                status: "DIVERGED"
            };
        }

        x = next;

        // 步长与函数值同时小于容差才算稳定收敛
        if (Math.abs(step) < tol && Math.abs(f(x)) < Math.max(tol, 1e-8)) {
            return {
                root: x,
                converged: true,
                iterations: i,
                finalValue: f(x),
                status: "CONVERGED"
            };
        }
    }

    const finalValue = f(x);
    return {
        root: x,
        converged: false,
        iterations: maxIter,
        finalValue,
        status: Number.isFinite(finalValue) ? "MAX_ITER_REACHED" : "NON_FINITE"
    };
}
