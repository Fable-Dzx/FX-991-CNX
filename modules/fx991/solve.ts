/**
 * SOLVE 粘合层：把方程文本 + 初始猜测值编译成一次"解析 → 牛顿迭代 → 结果"流程。
 *
 * 参考 feat/solve-newton 分支的 solve 部分重构：
 * - 解析器：modules/solver/equation.ts（更强：科学计数、单字母多变量、
 *   全角符号提示、三角函数按角度单位 DEG/RAD/GRA 求值）；
 * - 求解器：modules/solver/newton.ts（结构化 status 分类 +
 *   阻尼牛顿 / 驻点扰动等鲁棒性处理）；
 * - 本文件保持原有对外 API（compileEquation / solveByNewton / formatRoot /
 *   SolveSyntaxError / SolveResult）不变，供 logics / UI / 测试使用。
 */

import {
    compileEquation as compileWithUnit,
    collectVariables,
    EquationError,
    AngleUnit
} from "../solver/equation";
import { newtonSolve, NewtonStatus } from "../solver/newton";

/** 解析 / 语法错误（对上层保持原类名与签名） */
export class SolveSyntaxError extends Error {
    constructor(message: string, pos?: number) {
        super(pos !== undefined ? `${message} (at position ${pos})` : message);
        this.name = "SolveSyntaxError";
    }
}

export interface CompiledFunction {
    /** 求 f(x)（已移项为 f(x)=0） */
    eval(x: number): number;
    /** 方程中的变量名（自动检测，默认 x） */
    variable: string;
}

/**
 * 编译用户输入的方程。
 * - 支持 + - * / ^、括号、小数点、科学计数、隐式乘法（2x、2(x+1)）、
 *   函数 sin/cos/tan/asin/acos/atan/log/ln/sqrt/abs/exp、常数 pi/e、单字母变量。
 * - 支持一个 "="，自动移项：lhs - rhs = 0；不带等号视为 f(x)=0。
 * - 仅接受白名单字符，未知符号抛 SolveSyntaxError。
 * - 自动检测方程变量；多变量抛错，无变量默认 x。
 *
 * @param angleUnit 三角函数角度单位（默认 RAD；计算器 DEG/GRA 模式由调用方传入）
 */
export function compileEquation(
    input: string,
    angleUnit: AngleUnit = "RAD"
): CompiledFunction {
    const text = input.trim();
    if (text === "") {
        throw new SolveSyntaxError("方程为空");
    }
    try {
        const vars = collectVariables(text);
        if (vars.size > 1) {
            throw new SolveSyntaxError(
                `方程中包含多个变量（${Array.from(vars).join(", ")}），请只使用一个变量`
            );
        }
        const variable = vars.size === 1 ? vars.values().next().value : "x";
        const f = compileWithUnit(text, variable, angleUnit);
        return { eval: f, variable };
    } catch (e) {
        if (e instanceof SolveSyntaxError) {
            throw e;
        }
        if (e instanceof EquationError) {
            throw new SolveSyntaxError(e.message);
        }
        throw e;
    }
}

/* ================================================================== */
/* 牛顿求解（保持原有 SolveOptions / SolveResult 契约）                 */
/* ================================================================== */

export interface SolveOptions {
    /** 初始猜测值 */
    guess: number;
    /** 收敛容差（函数值与步长两个判据共用） */
    tol?: number;
    /** 最大迭代次数 */
    maxIter?: number;
}

export interface SolveResult {
    root: number;
    converged: boolean;
    iterations: number;
    /** 最终函数值 f(root) */
    fVal: number;
    /** 未收敛时的提示信息 */
    message?: string;
}

const STATUS_MESSAGES: Record<NewtonStatus, string | undefined> = {
    CONVERGED: undefined,
    ZERO_DERIVATIVE: "Derivative is zero or not finite",
    MAX_ITER_REACHED: "Max iterations reached",
    DIVERGED: "No solution found, adjust initial guess or check equation",
    NON_FINITE: "Function not finite"
};

/**
 * 牛顿迭代求 f(x)=0（阻尼牛顿 + 驻点扰动，见 modules/solver/newton.ts）。
 * 不抛异常：失败原因经 status 映射为 message 返回。
 */
export function solveByNewton(
    fn: (x: number) => number,
    options: SolveOptions
): SolveResult {
    const r = newtonSolve(fn, {
        x0: options.guess,
        tol: options.tol,
        maxIter: options.maxIter
    });
    return {
        root: r.root,
        converged: r.converged,
        iterations: r.iterations,
        fVal: r.finalValue,
        message: STATUS_MESSAGES[r.status]
    };
}

/** 格式化求解结果（限制有效位数，保持原有显示风格） */
export function formatRoot(v: number): string {
    if (!Number.isFinite(v)) {
        return "ERROR";
    }
    if (v === 0) {
        return "0";
    }
    const abs = Math.abs(v);
    if (abs >= 1e15 || abs < 1e-10) {
        return v.toExponential(10);
    }
    return String(Math.round(v * 1e10) / 1e10);
}
