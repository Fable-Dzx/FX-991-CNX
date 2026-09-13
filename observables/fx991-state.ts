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
import { SolveResult } from "../modules/fx991/solve";

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
    LINEAR3: ["a1", "b1", "c1", "d1", "a2", "b2", "c2", "d2", "a3", "b3", "c3", "d3"]
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

    // ---- SOLVE ----
    /** SOLVE 是否激活（EQN 类型选择按 5 进入） */
    solveActive: boolean = false;
    /** SOLVE 阶段：input=输入方程；guess=输入初始猜测；result=已求解 */
    solveStage: "input" | "guess" | "result" = "input";
    /** 方程文本（可含 =） */
    solveExpr: string = "";
    /** 初始猜测文本 */
    solveGuess: string = "";
    /** 解析后的求解结果 */
    solveResult: SolveResult | null = null;
    /** 求解错误信息（语法错误等） */
    solveError: string = "";
    /** 求解变量名（默认 x，由方程中的变量决定） */
    solveVariable: string = "x";

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
        this.statData = [];
        this.statResult = null;
        this.statDone = false;
        this.statEditIndex = -1;
        this.statKind = null;
        this.stat2dData = [];
        this.stat2dStage = "X";
        this.statReg = null;
        this.solveActive = false;
        this.solveStage = "input";
        this.solveExpr = "";
        this.solveGuess = "";
        this.solveResult = null;
        this.solveError = "";
        this.solveVariable = "x";
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

    /* ---------------- SOLVE ---------------- */

    /** 进入 SOLVE（从 EQN 类型选择） */
    enterSolve() {
        this.solveActive = true;
        this.solveStage = "input";
        this.solveExpr = "";
        this.solveGuess = "";
        this.solveResult = null;
        this.solveError = "";
        this.eqnType = null;
        this.eqnCoeffs = [];
        this.eqnResult = null;
        this.eqnDone = false;
    }

    /** 退出 SOLVE 返回 EQN 类型选择 */
    exitSolve() {
        this.solveActive = false;
        this.solveStage = "input";
        this.solveExpr = "";
        this.solveGuess = "";
        this.solveResult = null;
        this.solveError = "";
        this.solveVariable = "x";
    }

    /** 追加字符到当前输入（方程或猜测） */
    solveAppend(ch: string) {
        if (this.solveResult) {
            // 结果后输入数字/小数点/负号 → 换初始猜测重算；
            // 其他字符（字母/运算符/括号）→ 开始新方程
            const guessChar = /[0-9.\-]/.test(ch);
            this.solveResult = null;
            this.solveError = "";
            if (guessChar) {
                this.solveStage = "guess";
                this.solveGuess = "";
            } else {
                this.solveStage = "input";
                this.solveExpr = "";
            }
        }
        if (this.solveStage === "input") {
            // 方程：防止重复小数点
            const last = this.solveExpr.slice(-1);
            if (ch === "." && /[0-9.]/.test(last) && this.solveExpr.split(/[^0-9.]/).pop()!.includes(".")) {
                return;
            }
            this.solveExpr += ch;
        } else if (this.solveStage === "guess") {
            if (ch === "-") {
                if (this.solveGuess === "") {
                    this.solveGuess = "-";
                } else if (this.solveGuess === "-") {
                    this.solveGuess = "";
                }
                return;
            }
            const last = this.solveGuess.slice(-1);
            if (ch === "." && last !== "" && this.solveGuess.includes(".")) {
                return;
            }
            this.solveGuess += ch;
        }
    }

    solveBackspace() {
        if (this.solveResult) {
            return;
        }
        if (this.solveStage === "input" && this.solveExpr.length > 0) {
            this.solveExpr = this.solveExpr.slice(0, -1);
        } else if (this.solveStage === "guess" && this.solveGuess.length > 0) {
            this.solveGuess = this.solveGuess.slice(0, -1);
        }
    }

    solveClearAll() {
        this.solveExpr = "";
        this.solveGuess = "";
        this.solveResult = null;
        this.solveError = "";
        this.solveStage = "input";
    }

    setSolveResult(r: SolveResult) {
        this.solveResult = r;
        this.solveError = "";
        this.solveStage = "result";
    }

    setSolveError(msg: string) {
        this.solveError = msg;
        this.solveResult = null;
        this.solveStage = "input";
    }
}

export default new Fx991State();
