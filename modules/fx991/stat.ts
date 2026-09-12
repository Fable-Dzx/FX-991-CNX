import Decimal from "decimal.js";

/**
 * STAT (统计) 模式引擎。
 * 单变量统计：录入数据列表，计算 n / x̄ / σx / sx / Σx / Σx²。
 */

export interface StatResult {
    n: number;
    mean: Decimal;
    /** 总体标准差 */
    popStd: Decimal;
    /** 样本标准差 */
    sampleStd: Decimal;
    sum: Decimal;
    sumSq: Decimal;
}

const SIG = 12;

function fmt(d: Decimal): string {
    if (d.isZero()) {
        return "0";
    }
    if (d.abs().gte(new Decimal("1e20"))) {
        return d.toExponential(SIG);
    }
    return d.toSignificantDigits(SIG).toString();
}

export function computeStat(data: Decimal[]): StatResult {
    const n = data.length;
    if (n === 0) {
        return {
            n: 0,
            mean: new Decimal(0),
            popStd: new Decimal(0),
            sampleStd: new Decimal(0),
            sum: new Decimal(0),
            sumSq: new Decimal(0)
        };
    }

    let sum = new Decimal(0);
    let sumSq = new Decimal(0);
    for (const v of data) {
        sum = sum.plus(v);
        sumSq = sumSq.plus(v.mul(v));
    }

    const mean = sum.div(n);
    // 方差 = Σ(x-x̄)²/n = Σx²/n - x̄²
    const variance = sumSq.div(n).minus(mean.mul(mean));
    const popStd = variance.isNegative()
        ? new Decimal(0)
        : variance.sqrt();
    const sampleStd = n > 1
        ? variance.mul(n).div(n - 1).sqrt()
        : new Decimal(0);

    return { n, mean, popStd, sampleStd, sum, sumSq };
}

export const statResultToLines = (r: StatResult): string[] => [
    `n=${r.n}`,
    `x̄=${fmt(r.mean)}`,
    `σx=${fmt(r.popStd)}`,
    `sx=${fmt(r.sampleStd)}`,
    `Σx=${fmt(r.sum)}`,
    `Σx²=${fmt(r.sumSq)}`
];

/* ------------------------------------------------------------------ */
/* 双变量线性回归：y = a + b x，输出 a / b / r（相关系数）              */
/* ------------------------------------------------------------------ */

export interface RegResult {
    /** 截距 */
    a: Decimal;
    /** 斜率 */
    b: Decimal;
    /** 相关系数 */
    r: Decimal;
}

const ZERO = new Decimal(0);

export function computeReg2d(xs: Decimal[], ys: Decimal[]): RegResult {
    const n = xs.length;
    if (n === 0) {
        return { a: ZERO, b: ZERO, r: ZERO };
    }
    let sx = ZERO, sy = ZERO, sxy = ZERO, sxx = ZERO, syy = ZERO;
    for (let i = 0; i < n; i++) {
        const x = xs[i];
        const y = ys[i];
        sx = sx.plus(x);
        sy = sy.plus(y);
        sxy = sxy.plus(x.mul(y));
        sxx = sxx.plus(x.mul(x));
        syy = syy.plus(y.mul(y));
    }
    const nD = new Decimal(n);
    const num = nD.mul(sxy).minus(sx.mul(sy));
    const denomB = nD.mul(sxx).minus(sx.mul(sx));
    const b = denomB.isZero() ? new Decimal(0) : num.div(denomB);
    const a = sy.minus(b.mul(sx)).div(nD);
    const denomR = denomB.mul(nD.mul(syy).minus(sy.mul(sy)));
    const r = denomR.isZero() ? new Decimal(0) : num.div(denomR.sqrt());
    return { a, b, r };
}

export const regResultToLines = (r: RegResult): string[] => [
    `a=${fmt(r.a)}`,
    `b=${fmt(r.b)}`,
    `r=${fmt(r.r)}`
];
