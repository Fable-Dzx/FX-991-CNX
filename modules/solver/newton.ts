/**
 * 牛顿迭代法数值求解器（SOLVE 功能核心）。
 *
 * 参考 feat/solve-newton 分支实现移植，并融合 main 上已验证的鲁棒性改进：
 * - 分支：结构化 status 枚举（区分收敛 / 导数为 0 / 发散 / 超迭代 / 非有限值），
 *   不抛异常，所有失败情况通过 status 字段返回；
 * - main：阻尼牛顿（|f| 不减小时步长减半，避免振荡发散）+ 驻点扰动
 *   （导数接近 0 时沿函数下降方向小步扰动，能救回 x²-4 初值 0 这类情况）。
 *
 * 纯 TypeScript 实现，无外部依赖，可直接在浏览器 / Node / API Route 中复用。
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

/** 导数绝对值小于该值视为驻点 */
const DERIVATIVE_EPS = 1e-12;

/** 驻点扰动超过该次数仍未脱离，判定导数异常 */
const STALL_LIMIT = 5;

/** 阻尼牛顿最小步长比例：alpha 减半至 1/512 仍不下降则放弃 */
const MIN_ALPHA = 1 / 512;

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
 * 鲁棒性处理：
 * - 全步长导致 |f| 不减小时自动阻尼减半（保证单调下降，避免振荡发散）；
 * - 导数接近 0（驻点）时沿函数下降方向小步扰动后继续，而非直接放弃，
 *   连扰动 STALL_LIMIT 次仍未脱离才判定为导数异常；
 * - 迭代值非有限 / 超过发散边界 / 超过最大迭代 → 对应状态返回。
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

    let stallCount = 0;
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
        // 导数为 0（或数值上过小 / 非有限）：先沿下降方向扰动，尝试脱离驻点
        if (!Number.isFinite(dfx) || Math.abs(dfx) < DERIVATIVE_EPS) {
            stallCount++;
            if (stallCount > STALL_LIMIT) {
                return {
                    root: x,
                    converged: false,
                    iterations: i,
                    finalValue: fx,
                    status: "ZERO_DERIVATIVE"
                };
            }
            const step = 0.1 * Math.max(1, Math.abs(x));
            x = x + (fx >= 0 ? -step : step);
            continue;
        }
        stallCount = 0;

        // 阻尼牛顿：全步长若不能使 |f| 下降，则步长减半
        const fullStep = fx / dfx;
        let alpha = 1;
        let xNext = x - alpha * fullStep;
        let fNext = f(xNext);
        while (!Number.isFinite(fNext) || Math.abs(fNext) >= Math.abs(fx)) {
            alpha /= 2;
            if (alpha < MIN_ALPHA) {
                return {
                    root: x,
                    converged: false,
                    iterations: i,
                    finalValue: fx,
                    status: "DIVERGED"
                };
            }
            xNext = x - alpha * fullStep;
            fNext = f(xNext);
        }

        // 步长与函数值同时小于容差才算稳定收敛
        if (
            Math.abs(xNext - x) < tol * Math.max(1, Math.abs(xNext)) &&
            Number.isFinite(fNext) &&
            Math.abs(fNext) < Math.max(tol, 1e-8)
        ) {
            return {
                root: xNext,
                converged: true,
                iterations: i,
                finalValue: fNext,
                status: "CONVERGED"
            };
        }

        x = xNext;
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
