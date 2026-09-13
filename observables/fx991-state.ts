import { makeAutoObservable } from "mobx";
import Decimal from "decimal.js";
import { Cplx, CPLX_ZERO } from "../modules/fx991/cplx";
import { BaseRadix, BASE_RADICES } from "../modules/fx991/basen";
import {
    EqnType,
    EqnResult,
    solveQuadratic,
    solveCubic,
    solveLinear2,
    solveLinear3
} from "../modules/fx991/eqn";
import { computeStat, StatResult, computeReg2d, RegResult } from "../modules/fx991/stat";
import { solveEquation, SolveResult } from "../modules/fx991/solve";
import { CalculatorDRGMode } from "./calculator-state";

export type FxMode = "COMP" | "CMPLX" | "BASE_N" | "EQN" | "STAT";

export const FX_MODES: FxMode[] = ["COMP", "CMPLX", "BASE_N", "EQN", "STAT"];

export const MODE_MENU_ITEMS: Array<{ key: string; label: string }> = [
    { key: "1", label: "COMP  计算" },
    { key: "2", label: "CMPLX 复数" },
    { key: "3", label: "BASE-N 进制" },
    { key: "4", label: "EQN  方程" },
    { key: "5", label: "STAT 统计" }
];

/** 方程类型的系数名与求解决策 */
export const EQN_COEFF_NAMES: Record<EqnType, string[]> = {
    QUAD: ["a", "b", "c"],
    CUBIC: ["a", "b", "c", "d"],
    LINEAR2: ["a1", "b1", "c1", "a2", "b2", "c2"],
    LINEAR3: ["a1", "b1", "c1", "d1", "a2", "b2", "c2", "d2", "a3", "b3", "c3", "d3"],
    /** SOLVE 为文本方程输入，不使用系数录入流程 */
    SOLVE: []
};

class Fx991State {
    constructor() {
        makeAutoObservable(this);
    }

    // ---- 模式与菜单 ----
    mode: FxMode = "COMP";
    showModeMenu: boolean = false;
    errorMessage: string = "";

    // ---- CMPLX ----
    cplxInput: string = "";
    cplxResult: Cplx | null = null;
    cplxPolar: boolean = false;

    // ---- BASE-N ----
    baseRadix: BaseRadix = "DEC";
    baseInput: string = "";
    baseResult: Decimal | null = null;
    baseLastOp: string = ""; // "+" | "-" | "*" | "/" | "AND" | ...
    baseAccum: Decimal | null = null;

    // ---- EQN ----
    eqnType: EqnType | null = null;
    /** 已确认的系数 */
    eqnCoeffs: string[] = [];
    /** 当前正在输入的系数 */
    eqnCur: string = "";
    eqnResult: EqnResult | null = null;
    eqnDone: boolean = false;

    // ---- SOLVE（一键解方程，EQN 模式的第 5 类） ----
    /** 方程文本，如 "x^2 - 4 = 0" */
    solveEqn: string = "";
    /** 求解变量，默认 x */
    solveVar: string = "x";
    /** 初始猜测值文本 */
    solveGuess: string = "0";
    /** 最近一次求解结果 */
    solveResult: SolveResult | null = null;

    // ---- STAT ----
    /** 统计类型：null=未选择；1VAR 单变量；2VAR 双变量回归 */
    statKind: "1VAR" | "2VAR" | null = null;
    statData: Decimal[] = [];
    statResult: StatResult | null = null;
    statDone: boolean = false;
    statEditIndex: number = -1;
    /** 双变量数据对 */
    stat2dData: { x: Decimal; y: Decimal }[] = [];
    /** 双变量录入阶段：先输入 x，再输入 y */
    stat2dStage: "X" | "Y" = "X";
    /** 线性回归结果 a / b / r */
    statReg: RegResult | null = null;

    /* ---------------- 模式切换 ---------------- */

    setMode(m: FxMode) {
        this.mode = m;
        this.showModeMenu = false;
        this.errorMessage = "";
        this.cplxInput = "";
        this.cplxResult = null;
        this.baseInput = "";
        this.baseResult = null;
        this.baseAccum = null;
        this.baseLastOp = "";
        this.baseRadix = "DEC";
        this.eqnType = null;
        this.eqnCoeffs = [];
        this.eqnCur = "";
        this.eqnResult = null;
        this.eqnDone = false;
        this.solveEqn = "";
        this.solveVar = "x";
        this.solveGuess = "0";
        this.solveResult = null;
        this.statData = [];
        this.statResult = null;
        this.statDone = false;
        this.statEditIndex = -1;
        this.statKind = null;
        this.stat2dData = [];
        this.stat2dStage = "X";
        this.statReg = null;
    }

    openModeMenu() {
        this.showModeMenu = true;
        this.errorMessage = "";
    }

    closeModeMenu() {
        this.showModeMenu = false;
    }

    /* ---------------- CMPLX ---------------- */

    cplxAppend(ch: string) {
        if (this.errorMessage) {
            this.clearFxError();
        }
        if (this.cplxResult !== null && !this.cplxInput) {
            // 从结果继续输入时清掉结果
        }
        this.cplxInput += ch;
    }

    cplxBackspace() {
        this.cplxInput = this.cplxInput.slice(0, -1);
    }

    cplxClear() {
        this.cplxInput = "";
        this.cplxResult = null;
    }

    setCplxResult(r: Cplx) {
        this.cplxResult = r;
    }

    toggleCplxPolar() {
        this.cplxPolar = !this.cplxPolar;
    }

    /* ---------------- BASE-N ---------------- */

    cycleBaseRadix() {
        const idx = BASE_RADICES.indexOf(this.baseRadix);
        this.baseRadix = BASE_RADICES[(idx + 1) % BASE_RADICES.length];
        this.baseInput = "";
        this.baseResult = null;
        this.baseAccum = null;
        this.baseLastOp = "";
    }

    baseAppend(ch: string) {
        if (this.errorMessage) {
            this.clearFxError();
        }
        this.baseInput += ch;
    }

    baseBackspace() {
        this.baseInput = this.baseInput.slice(0, -1);
    }

    baseClear() {
        this.baseInput = "";
        this.baseResult = null;
        this.baseAccum = null;
        this.baseLastOp = "";
    }

    setBaseResult(r: Decimal) {
        this.baseResult = r;
    }

    /* ---------------- EQN ---------------- */

    setEqnType(t: EqnType) {
        this.eqnType = t;
        this.eqnCoeffs = [];
        this.eqnCur = "";
        this.eqnResult = null;
        this.eqnDone = false;
    }

    eqnAppendDigit(ch: string) {
        if (this.eqnDone || this.eqnType === null) {
            return;
        }
        if (ch === "-") {
            if (this.eqnCur === "") {
                this.eqnCur = "-";
            } else if (this.eqnCur === "-") {
                this.eqnCur = "";
            }
            return;
        }
        // 一个小数点限制
        if (ch === "." && this.eqnCur.includes(".")) {
            return;
        }
        this.eqnCur += ch;
    }

    /** 确认当前系数并进入下一个；全部系数就绪时求解 */
    eqnEnter() {
        if (this.eqnType === null || this.eqnDone) {
            return;
        }
        const names = EQN_COEFF_NAMES[this.eqnType];
        let cur = this.eqnCur;
        if (cur === "-") {
            cur = "-1";
        }
        if (cur === "") {
            cur = "0";
        }
        this.eqnCoeffs.push(cur);
        this.eqnCur = "";

        if (this.eqnCoeffs.length >= names.length) {
            // 所有系数就绪，立刻求解
            this.eqnSolve();
        }
    }

    eqnSolve() {
        if (this.eqnType === null || this.eqnResult) {
            return;
        }
        if (this.eqnType === "SOLVE") {
            // SOLVE 走独立的 solveRun 流程
            return;
        }
        const nums = this.eqnCoeffs.map(x => new Decimal(x || "0"));
        let result: EqnResult;
        switch (this.eqnType) {
            case "QUAD":
                result = solveQuadratic(nums[0], nums[1], nums[2]);
                break;
            case "CUBIC":
                result = solveCubic(nums[0], nums[1], nums[2], nums[3]);
                break;
            case "LINEAR2":
                result = solveLinear2(
                    nums[0], nums[1], nums[2],
                    nums[3], nums[4], nums[5]
                );
                break;
            case "LINEAR3":
                result = solveLinear3(
                    nums[0], nums[1], nums[2], nums[3],
                    nums[4], nums[5], nums[6], nums[7],
                    nums[8], nums[9], nums[10], nums[11]
                );
                break;
        }
        this.eqnResult = result;
        this.eqnDone = true;
    }

    eqnBackspace() {
        if (this.eqnDone) {
            return;
        }
        if (this.eqnCur.length > 0) {
            this.eqnCur = this.eqnCur.slice(0, -1);
        } else if (this.eqnCoeffs.length > 0) {
            this.eqnCur = this.eqnCoeffs.pop()!;
        }
    }

    eqnClearAll() {
        this.eqnCoeffs = [];
        this.eqnCur = "";
        this.eqnResult = null;
        this.eqnDone = false;
    }

    setEqnResult(r: EqnResult) {
        this.eqnResult = r;
        this.eqnDone = true;
    }

    eqnReEdit() {
        if (this.eqnResult) {
            this.eqnCoeffs = [];
            this.eqnCur = "";
            this.eqnResult = null;
            this.eqnDone = false;
        }
    }

    /* ---------------- SOLVE（一键解方程） ---------------- */

    solveSetEqn(text: string) {
        this.solveEqn = text;
        this.errorMessage = "";
    }

    solveSetVar(v: string) {
        this.solveVar = v;
        this.errorMessage = "";
    }

    solveSetGuess(g: string) {
        this.solveGuess = g;
        this.errorMessage = "";
    }

    /** 执行一键求解；drg 取自计算器当前角度单位 */
    solveRun(drg: CalculatorDRGMode) {
        const guessText = this.solveGuess.trim();
        const guessNum = Number(guessText === "" ? "0" : guessText);
        this.solveResult = solveEquation(
            this.solveEqn,
            this.solveVar || "x",
            guessNum,
            drg
        );
    }

    /** 清空 SOLVE 输入与结果 */
    solveClear() {
        this.solveEqn = "";
        this.solveVar = "x";
        this.solveGuess = "0";
        this.solveResult = null;
        this.errorMessage = "";
    }

    /* ---------------- STAT ---------------- */

    statAddValue(v: Decimal) {
        if (this.statDone) {
            return;
        }
        this.statData.push(v);
    }

    statUndo() {
        if (this.statData.length > 0) {
            this.statData.pop();
        }
    }

    statCompute() {
        this.statResult = computeStat(this.statData);
        this.statDone = true;
    }

    statReEdit() {
        this.statDone = false;
        this.statResult = null;
    }

    /* ---------------- STAT 2-VAR ---------------- */

    setStatKind(k: "1VAR" | "2VAR") {
        this.statKind = k;
        this.statData = [];
        this.statResult = null;
        this.statDone = false;
        this.stat2dData = [];
        this.stat2dStage = "X";
        this.statReg = null;
        this.cplxInput = "";
    }

    /** 2-VAR：确认当前阶段输入。X 阶段暂存并转到 Y；Y 阶段配对存入 */
    stat2dEnter(v: Decimal): boolean {
        if (this.stat2dStage === "X") {
            this.stat2dPendingX = v;
            this.stat2dStage = "Y";
            return false;
        }
        this.stat2dData.push({ x: this.stat2dPendingX, y: v });
        this.stat2dStage = "X";
        return true;
    }

    /** 2-VAR：暂存刚输入的 x，等 y 输入后配对 */
    stat2dPendingX: Decimal = new Decimal(0);

    stat2dUndo() {
        if (this.stat2dStage === "Y") {
            this.stat2dStage = "X";
            return;
        }
        if (this.stat2dData.length > 0) {
            this.stat2dData.pop();
        }
    }

    statCompute2d() {
        if (this.stat2dData.length === 0) {
            this.setFxError("No data");
            return;
        }
        const xs = this.stat2dData.map(d => d.x);
        const ys = this.stat2dData.map(d => d.y);
        this.statReg = computeReg2d(xs, ys);
        this.statDone = true;
    }

    /* ---------------- error ---------------- */

    setFxError(msg: string) {
        this.errorMessage = msg;
    }

    clearFxError() {
        this.errorMessage = "";
    }
}

export default new Fx991State();
