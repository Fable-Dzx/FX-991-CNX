import {
    compileEquation,
    EquationError,
    AngleUnit
} from "../solver/equation";
import { newtonSolve, NewtonResult } from "../solver/newton";

/**
 * SOLVE（一键解方程）粘合层：
 * 把方程文本 + 变量 + 初始猜测值 + 当前角度单位，
 * 组合成一次完整的"编译 → 牛顿迭代 → 结果格式化"流程。
 */

export interface SolveOutcome {
    ok: true;
    /** 求得的根（数值） */
    root: number;
    /** 格式化后的根（与 EQN 系数求解显示风格一致） */
    rootText: string;
    /** 是否收敛 */
    converged: boolean;
    /** 迭代次数 */
    iterations: number;
    /** 最终函数值 */
    finalValue: number;
    /** 牛顿法状态码 */
    status: NewtonResult["status"];
}

export interface SolveFailure {
    ok: false;
    /** 面向用户的错误信息 */
    error: string;
}

export type SolveResult = SolveOutcome | SolveFailure;

const SIG = 15;

/** 数值格式化：与 modules/fx991/eqn.ts 的显示风格保持一致 */
export function formatRoot(v: number): string {
    if (!Number.isFinite(v)) {
        return String(v);
    }
    if (Math.abs(v) < 1e-14) {
        return "0";
    }
    if (Math.abs(v) >= 1e20) {
        return v.toExponential(SIG);
    }
    return Number(v.toPrecision(SIG)).toString();
}

/** 计算器 DRG 模式（D/R/G）→ 求解器角度单位 */
export function drgToAngleUnit(drg: "D" | "R" | "G"): AngleUnit {
    switch (drg) {
        case "D":
            return "DEG";
        case "G":
            return "GRA";
        default:
            return "RAD";
    }
}

/**
 * 一键求解 f(x)=0。
 *
 * @param equation  方程文本，可带等号（自动移项），如 "x^2 - 4 = 0"
 * @param varName   求解变量（默认 x）
 * @param guess     初始猜测值（默认 0）
 * @param drg       当前角度单位模式（默认 R 弧度）
 */
export function solveEquation(
    equation: string,
    varName: string = "x",
    guess: number = 0,
    drg: "D" | "R" | "G" = "R"
): SolveResult {
    let f: (x: number) => number;
    try {
        f = compileEquation(equation, varName, drgToAngleUnit(drg));
    } catch (e) {
        if (e instanceof EquationError) {
            return { ok: false, error: e.message };
        }
        return { ok: false, error: (e as Error).message || "方程解析失败" };
    }

    if (!Number.isFinite(guess)) {
        return { ok: false, error: "初始猜测值必须是有限实数" };
    }

    const r = newtonSolve(f, { x0: guess });

    return {
        ok: true,
        root: r.root,
        rootText: formatRoot(r.root),
        converged: r.converged,
        iterations: r.iterations,
        finalValue: r.finalValue,
        status: r.status
    };
}
