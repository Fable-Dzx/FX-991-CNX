/**
 * SOLVE 引擎：解析一元方程并求 f(x)=0 的数值解。
 *
 * 设计要点：
 * 1. 安全：递归下降解析器 + 白名单，绝不 eval 用户输入。
 * 2. 等号：输入可带 "="，自动移项为 f(x)=lhs-rhs；不带 "=" 视为 f(x)=表达式（默认 =0）。
 * 3. 求导：中心差分数值近似，无需解析求导。
 * 4. 求解：牛顿迭代，处理导数接近 0、发散、非有限值、超迭代上限等异常。
 * 5. 纯函数、零依赖，便于单元测试。
 */

/* ================================================================== */
/* 词法                                                                */
/* ================================================================== */

const FUNCTIONS = new Set([
    "sin", "cos", "tan", "asin", "acos", "atan",
    "log", "ln", "sqrt", "abs", "exp"
]);

const CONSTANTS: Record<string, number> = {
    pi: Math.PI,
    e: Math.E
};

type TokenType = "NUM" | "IDENT" | "OP" | "LPAREN" | "RPAREN" | "END";

interface Token {
    type: TokenType;
    value: string;
    pos: number;
}

export class SolveSyntaxError extends Error {
    constructor(message: string, pos?: number) {
        super(pos !== undefined ? `${message} (at position ${pos})` : message);
        this.name = "SolveSyntaxError";
    }
}

/** 词法分析：数字（小数）、标识符、运算符、括号 */
function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const n = input.length;
    while (i < n) {
        const c = input[i];
        if (c === " " || c === "\t" || c === "\n") {
            i++;
            continue;
        }
        if (/[0-9.]/.test(c)) {
            const start = i;
            while (i < n && /[0-9.]/.test(input[i])) {
                i++;
            }
            const raw = input.slice(start, i);
            // 最多一个小数点
            if ((raw.match(/\./g) || []).length > 1) {
                throw new SolveSyntaxError("Invalid number", start);
            }
            tokens.push({ type: "NUM", value: raw, pos: start });
            continue;
        }
        if (/[a-zA-Z]/.test(c)) {
            const start = i;
            while (i < n && /[a-zA-Z0-9]/.test(input[i])) {
                i++;
            }
            tokens.push({ type: "IDENT", value: input.slice(start, i), pos: start });
            continue;
        }
        if (c === "+" || c === "-" || c === "*" || c === "/" || c === "^") {
            tokens.push({ type: "OP", value: c, pos: i });
            i++;
            continue;
        }
        if (c === "(") {
            tokens.push({ type: "LPAREN", value: c, pos: i });
            i++;
            continue;
        }
        if (c === ")") {
            tokens.push({ type: "RPAREN", value: c, pos: i });
            i++;
            continue;
        }
        throw new SolveSyntaxError(`Unknown symbol "${c}"`, i);
    }
    tokens.push({ type: "END", value: "", pos: n });
    return tokens;
}

/** 在可结束值的位置与下一个值开始位置之间插入隐式乘号（如 2x、2(x+1)、x sin(x)） */
function insertImplicitMul(tokens: Token[]): Token[] {
    const out: Token[] = [];
    const endsValue = (t: Token): boolean =>
        t.type === "NUM" ||
        t.type === "RPAREN" ||
        (t.type === "IDENT" && !FUNCTIONS.has(t.value));
    const startsValue = (t: Token): boolean =>
        t.type === "NUM" ||
        t.type === "LPAREN" ||
        (t.type === "IDENT" && !FUNCTIONS.has(t.value)) ||
        (t.type === "IDENT" && FUNCTIONS.has(t.value));
    for (let i = 0; i < tokens.length; i++) {
        const cur = tokens[i];
        if (i > 0 && endsValue(out[out.length - 1]) && startsValue(cur)) {
            out.push({ type: "OP", value: "*", pos: cur.pos });
        }
        out.push(cur);
    }
    return out;
}

/* ================================================================== */
/* 语法（递归下降）→ AST                                               */
/* ================================================================== */

type Node =
    | { kind: "num"; value: number }
    | { kind: "var"; name: string }
    | { kind: "const"; name: string }
    | { kind: "neg"; child: Node }
    | { kind: "bin"; op: string; left: Node; right: Node }
    | { kind: "call"; fn: string; arg: Node };

class Parser {
    private tokens: Token[];
    private idx = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    private peek(): Token {
        return this.tokens[this.idx];
    }

    private next(): Token {
        return this.tokens[this.idx++];
    }

    parse(): Node {
        const node = this.expr();
        const t = this.peek();
        if (t.type !== "END") {
            throw new SolveSyntaxError("Unexpected token", t.pos);
        }
        return node;
    }

    /** expr := term (('+'|'-') term)* */
    private expr(): Node {
        let left = this.term();
        while (this.peek().type === "OP" &&
            (this.peek().value === "+" || this.peek().value === "-")) {
            const op = this.next().value;
            const right = this.term();
            left = { kind: "bin", op, left, right };
        }
        return left;
    }

    /** term := factor (('*'|'/') factor)* */
    private term(): Node {
        let left = this.factor();
        while (this.peek().type === "OP" &&
            (this.peek().value === "*" || this.peek().value === "/")) {
            const op = this.next().value;
            const right = this.factor();
            left = { kind: "bin", op, left, right };
        }
        return left;
    }

    /** factor := unary ('^' factor)?  幂右结合 */
    private factor(): Node {
        const base = this.unary();
        if (this.peek().type === "OP" && this.peek().value === "^") {
            this.next();
            const exp = this.factor();
            return { kind: "bin", op: "^", left: base, right: exp };
        }
        return base;
    }

    /** unary := ('+'|'-') unary | primary */
    private unary(): Node {
        const t = this.peek();
        if (t.type === "OP" && (t.value === "-" || t.value === "+")) {
            this.next();
            const child = this.unary();
            return t.value === "-" ? { kind: "neg", child } : child;
        }
        return this.primary();
    }

    /** primary := number | ident | ident '(' expr ')' | '(' expr ')' */
    private primary(): Node {
        const t = this.next();
        switch (t.type) {
            case "NUM":
                if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t.value)) {
                    throw new SolveSyntaxError("Invalid number", t.pos);
                }
                return { kind: "num", value: parseFloat(t.value) };
            case "LPAREN": {
                const node = this.expr();
                const close = this.next();
                if (close.type !== "RPAREN") {
                    throw new SolveSyntaxError("Missing )", close.pos);
                }
                return node;
            }
            case "IDENT": {
                const name = t.value.toLowerCase();
                if (name in CONSTANTS) {
                    return { kind: "const", name };
                }
                if (FUNCTIONS.has(name)) {
                    // 函数调用必须带括号
                    const lp = this.next();
                    if (lp.type !== "LPAREN") {
                        throw new SolveSyntaxError(`Function ${name} needs (`, lp.pos);
                    }
                    const arg = this.expr();
                    const close = this.next();
                    if (close.type !== "RPAREN") {
                        throw new SolveSyntaxError("Missing )", close.pos);
                    }
                    return { kind: "call", fn: name, arg };
                }
                // 变量
                return { kind: "var", name };
            }
            default:
                throw new SolveSyntaxError("Unexpected token", t.pos);
        }
    }
}

/* ================================================================== */
/* 求值                                                                */
/* ================================================================== */

function evalNode(node: Node, vars: Record<string, number>): number {
    switch (node.kind) {
        case "num":
            return node.value;
        case "const":
            return CONSTANTS[node.name];
        case "var": {
            const v = vars[node.name];
            if (v === undefined) {
                throw new SolveSyntaxError(`Unknown variable "${node.name}"`);
            }
            return v;
        }
        case "neg":
            return -evalNode(node.child, vars);
        case "bin": {
            const l = evalNode(node.left, vars);
            const r = evalNode(node.right, vars);
            switch (node.op) {
                case "+":
                    return l + r;
                case "-":
                    return l - r;
                case "*":
                    return l * r;
                case "/":
                    return l / r; // 除零得到 ±Infinity/NaN，由牛顿循环判定
                case "^":
                    return Math.pow(l, r);
                default:
                    throw new SolveSyntaxError(`Unknown operator "${node.op}"`);
            }
        }
        case "call": {
            const a = evalNode(node.arg, vars);
            switch (node.fn) {
                case "sin":
                    return Math.sin(a);
                case "cos":
                    return Math.cos(a);
                case "tan":
                    return Math.tan(a);
                case "asin":
                    return Math.asin(a);
                case "acos":
                    return Math.acos(a);
                case "atan":
                    return Math.atan(a);
                case "log":
                    return Math.log10(a);
                case "ln":
                    return Math.log(a);
                case "sqrt":
                    return Math.sqrt(a);
                case "abs":
                    return Math.abs(a);
                case "exp":
                    return Math.exp(a);
                default:
                    throw new SolveSyntaxError(`Unknown function "${node.fn}"`);
            }
        }
    }
}

/* ================================================================== */
/* 公共 API                                                            */
/* ================================================================== */

export interface CompiledFunction {
    /** 求 f(x) */
    eval(x: number): number;
    /** 方程中的变量名（已校验为单一变量） */
    variable: string;
}

/**
 * 编译用户输入的方程。
 * - 支持 + - * / ^、括号、小数点、隐式乘法（2x、2(x+1)）、
 *   函数 sin/cos/tan/asin/acos/atan/log/ln/sqrt/abs/exp、常数 pi/e、变量。
 * - 支持一个 "="，自动移项：lhs - rhs = 0。
 * - 仅接受白名单字符，未知符号抛 SolveSyntaxError。
 * - 方程必须只含一个变量，否则抛错。
 */
export function compileEquation(input: string): CompiledFunction {
    if (!input || input.trim() === "") {
        throw new SolveSyntaxError("Empty equation");
    }
    const eqIdx = input.indexOf("=");
    const rhsIdx = input.indexOf("=", eqIdx + 1);
    if (rhsIdx !== -1) {
        throw new SolveSyntaxError("Multiple '=' are not allowed");
    }
    const lhsRaw = eqIdx === -1 ? input : input.slice(0, eqIdx);
    const rhsRaw = eqIdx === -1 ? "" : input.slice(eqIdx + 1);

    const lhsAst = new Parser(insertImplicitMul(tokenize(lhsRaw))).parse();
    const rhsAst: Node = rhsRaw.trim() === ""
        ? { kind: "num", value: 0 }
        : new Parser(insertImplicitMul(tokenize(rhsRaw))).parse();

    // 收集变量并校验单一变量
    const vars = new Set<string>();
    const collect = (node: Node): void => {
        if (node.kind === "var") {
            vars.add(node.name);
        } else if (node.kind === "neg") {
            collect(node.child);
        } else if (node.kind === "bin") {
            collect(node.left);
            collect(node.right);
        } else if (node.kind === "call") {
            collect(node.arg);
        }
    };
    collect(lhsAst);
    collect(rhsAst);

    const allowedVars = new Set(["x", "y"]);
    vars.forEach((v) => {
        if (!allowedVars.has(v)) {
            throw new SolveSyntaxError(`Unsupported variable "${v}"`);
        }
    });
    if (vars.size > 1) {
        throw new SolveSyntaxError("Only one variable is allowed");
    }
    const variable = vars.size === 1 ? vars.values().next().value : "x";

    return {
        variable,
        eval(x: number): number {
            const varsMap: Record<string, number> = { [variable]: x };
            return evalNode(lhsAst, varsMap) - evalNode(rhsAst, varsMap);
        }
    };
}

/* ================================================================== */
/* 牛顿迭代                                                            */
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

/** 中心差分数值导数，步长随 |x| 缩放 */
export function centralDiff(fn: (x: number) => number, x: number): number {
    const h = 1e-6 * Math.max(1, Math.abs(x));
    const fPlus = fn(x + h);
    const fMinus = fn(x - h);
    return (fPlus - fMinus) / (2 * h);
}

/**
 * 阻尼牛顿迭代求 f(x)=0，对初值更鲁棒：
 * - 导数接近 0 / 非有限：沿函数下降方向小步扰动后继续，而非直接放弃
 *   （连扰动 5 次仍未脱离才判定为导数异常）；
 * - 全步长导致 |f| 不减小时自动阻尼减半（保证单调下降，避免振荡发散）；
 * - 迭代值非有限（发散）/ 超过最大迭代 → 返回未收敛。
 */
export function solveByNewton(fn: (x: number) => number, options: SolveOptions): SolveResult {
    const tol = options.tol ?? 1e-9;
    const maxIter = options.maxIter ?? 100;

    let x = options.guess;
    if (!Number.isFinite(x)) {
        return { root: NaN, converged: false, iterations: 0, fVal: NaN, message: "Invalid initial guess" };
    }

    let stallCount = 0;
    for (let iter = 0; iter < maxIter; iter++) {
        const f = fn(x);
        if (!Number.isFinite(f)) {
            return { root: x, converged: false, iterations: iter + 1, fVal: f, message: "Function not finite" };
        }
        if (Math.abs(f) < tol) {
            return { root: x, converged: true, iterations: iter, fVal: f };
        }
        const df = centralDiff(fn, x);
        if (!Number.isFinite(df) || Math.abs(df) < 1e-12) {
            // 驻点/导数过小：沿下降方向扰动，尝试脱离
            stallCount++;
            if (stallCount > 5) {
                return {
                    root: x,
                    converged: false,
                    iterations: iter + 1,
                    fVal: f,
                    message: "Derivative is zero or not finite"
                };
            }
            const step = 0.1 * Math.max(1, Math.abs(x));
            x = x + (f >= 0 ? -step : step);
            continue;
        }
        stallCount = 0;

        // 阻尼牛顿：全步长若不能使 |f| 下降，则减半步长
        const fullStep = f / df;
        let alpha = 1;
        let xNext = x - alpha * fullStep;
        let fNext = fn(xNext);
        while (!Number.isFinite(fNext) || Math.abs(fNext) >= Math.abs(f)) {
            alpha /= 2;
            if (alpha < 1 / 512) {
                return {
                    root: x,
                    converged: false,
                    iterations: iter + 1,
                    fVal: f,
                    message: "No solution found, adjust initial guess or check equation"
                };
            }
            xNext = x - alpha * fullStep;
            fNext = fn(xNext);
        }

        // 步长收敛判据
        if (Math.abs(xNext - x) <= tol * Math.max(1, Math.abs(xNext))) {
            return {
                root: xNext,
                converged: Number.isFinite(fNext) && Math.abs(fNext) < tol * 1e3,
                iterations: iter + 1,
                fVal: Number.isFinite(fNext) ? fNext : f
            };
        }
        x = xNext;
    }

    return {
        root: x,
        converged: false,
        iterations: maxIter,
        fVal: fn(x),
        message: "Max iterations reached"
    };
}

/** 格式化求解结果（限制有效位数） */
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
