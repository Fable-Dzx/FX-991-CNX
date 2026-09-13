/**
 * 一元方程解析 / 编译器（SOLVE 功能）。
 *
 * 安全设计：
 * - 完全手写的 tokenizer + 递归下降解析器，输出 AST 后由闭包求值；
 * - 标识符、函数名、常数全部走白名单，未知记号直接报错；
 * - 绝不使用 eval / new Function，用户输入不可能变成可执行代码。
 *
 * 支持的语法：
 * - 运算符：+ - * / ^（^ 右结合）、一元负号（优先级低于 ^，即 -2^2 = -4）
 * - 括号、小数点、科学计数（1e-3 / 2.5E10）
 * - 隐式乘法：2x、3(x+1)、2sin(x)、xy
 * - 函数：sin cos tan asin acos atan log ln sqrt abs exp（要求括号，如 sin(x)）
 * - 常数：pi、e
 * - 等号：输入 "lhs = rhs" 时自动移项为 f(x) = lhs - rhs；
 *   不带等号时视为 f(x) = 输入表达式
 * - 变量：任意单字母或多字母标识符，编译时指定求解变量，
 *   其余标识符若出现在白名单之外则报错
 */

export type AngleUnit = "RAD" | "DEG" | "GRA";

/** 解析 / 编译错误，带面向用户的信息 */
export class EquationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EquationError";
    }
}

/* ------------------------------------------------------------------ */
/* Tokenizer                                                           */
/* ------------------------------------------------------------------ */

type TokenType = "NUM" | "IDENT" | "OP" | "LPAREN" | "RPAREN" | "EQ";

interface Token {
    type: TokenType;
    value: string;
    pos: number;
}

const OPERATORS = new Set(["+", "-", "*", "/", "^"]);

function tokenize(src: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < src.length) {
        const ch = src[i];

        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
            i++;
            continue;
        }

        // 数字（含小数点与科学计数 1.5e-3）
        if ((ch >= "0" && ch <= "9") || ch === ".") {
            const start = i;
            let dotCount = 0;
            while (
                i < src.length &&
                ((src[i] >= "0" && src[i] <= "9") || src[i] === ".")
            ) {
                if (src[i] === ".") {
                    dotCount++;
                }
                i++;
            }
            if (dotCount > 1) {
                throw new EquationError(`数字中小数点过多（位置 ${start + 1}）`);
            }
            // 科学计数后缀 e/E（后面可跟 +/-）
            if (
                i < src.length &&
                (src[i] === "e" || src[i] === "E") &&
                i + 1 < src.length &&
                ((src[i + 1] >= "0" && src[i + 1] <= "9") ||
                    ((src[i + 1] === "+" || src[i + 1] === "-") &&
                        i + 2 < src.length &&
                        src[i + 2] >= "0" &&
                        src[i + 2] <= "9"))
            ) {
                i++; // e
                if (src[i] === "+" || src[i] === "-") {
                    i++;
                }
                while (i < src.length && src[i] >= "0" && src[i] <= "9") {
                    i++;
                }
            }
            const text = src.slice(start, i);
            if (text === ".") {
                throw new EquationError(`孤立的小数点（位置 ${start + 1}）`);
            }
            tokens.push({ type: "NUM", value: text, pos: start });
            continue;
        }

        // 标识符（变量 / 函数 / 常数），白名单在解析阶段校验
        if (
            (ch >= "a" && ch <= "z") ||
            (ch >= "A" && ch <= "Z") ||
            ch === "_"
        ) {
            const start = i;
            while (
                i < src.length &&
                ((src[i] >= "a" && src[i] <= "z") ||
                    (src[i] >= "A" && src[i] <= "Z") ||
                    (src[i] >= "0" && src[i] <= "9") ||
                    src[i] === "_")
            ) {
                i++;
            }
            tokens.push({
                type: "IDENT",
                value: src.slice(start, i),
                pos: start
            });
            continue;
        }

        if (ch === "(") {
            tokens.push({ type: "LPAREN", value: ch, pos: i });
            i++;
            continue;
        }
        if (ch === ")") {
            tokens.push({ type: "RPAREN", value: ch, pos: i });
            i++;
            continue;
        }
        if (ch === "=") {
            tokens.push({ type: "EQ", value: ch, pos: i });
            i++;
            continue;
        }
        if (OPERATORS.has(ch)) {
            tokens.push({ type: "OP", value: ch, pos: i });
            i++;
            continue;
        }

        // 全角字符友好提示
        if (ch === "（" || ch === "）" || ch === "＝" || ch === "＋" ||
            ch === "－" || ch === "＊" || ch === "／") {
            throw new EquationError(
                `不支持全角符号 "${ch}"（位置 ${i + 1}），请使用半角输入`
            );
        }

        throw new EquationError(
            `非法字符 "${ch}"（位置 ${i + 1}）`
        );
    }

    return tokens;
}

/* ------------------------------------------------------------------ */
/* AST                                                                 */
/* ------------------------------------------------------------------ */

type Node =
    | { kind: "num"; value: number }
    | { kind: "var"; name: string }
    | { kind: "neg"; arg: Node }
    | { kind: "bin"; op: "+" | "-" | "*" | "/" | "^"; left: Node; right: Node }
    | { kind: "fn"; name: FnName; arg: Node };

type FnName =
    | "sin" | "cos" | "tan"
    | "asin" | "acos" | "atan"
    | "log" | "ln" | "sqrt" | "abs" | "exp";

const FN_NAMES: ReadonlySet<string> = new Set<FnName>([
    "sin", "cos", "tan",
    "asin", "acos", "atan",
    "log", "ln", "sqrt", "abs", "exp"
]);

const CONST_NAMES: ReadonlySet<string> = new Set(["pi"]);

/** 允许的变量名（单字母，排除已用作常数的 e；e 保留为自然常数） */
function isAllowedVariable(name: string): boolean {
    return /^[a-zA-Z]$/.test(name) && name !== "e";
}

/* ------------------------------------------------------------------ */
/* 递归下降解析器                                                       */
/* ------------------------------------------------------------------ */

class Parser {
    private tokens: Token[];
    private idx = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    /** equation := expr [ '=' expr ]，带等号时移项为 lhs - rhs */
    parseEquation(): Node {
        const lhs = this.parseExpr();
        if (this.peek()?.type === "EQ") {
            this.next();
            const rhs = this.parseExpr();
            if (this.peek() !== undefined) {
                throw new EquationError("等号数量过多（只支持一个 =）");
            }
            return { kind: "bin", op: "-", left: lhs, right: rhs };
        }
        if (this.peek() !== undefined) {
            throw new EquationError(
                `意外的记号 "${this.peek()!.value}"（位置 ${this.peek()!.pos + 1}）`
            );
        }
        return lhs;
    }

    /** expr := term (('+' | '-') term)* */
    private parseExpr(): Node {
        let left = this.parseTerm();
        while (true) {
            const t = this.peek();
            if (t?.type === "OP" && (t.value === "+" || t.value === "-")) {
                this.next();
                left = {
                    kind: "bin",
                    op: t.value as "+" | "-",
                    left,
                    right: this.parseTerm()
                };
            } else {
                break;
            }
        }
        return left;
    }

    /** term := factor (('*' | '/') factor | 隐式乘法 factor)* */
    private parseTerm(): Node {
        let left = this.parseFactor();
        while (true) {
            const t = this.peek();
            if (t?.type === "OP" && (t.value === "*" || t.value === "/")) {
                this.next();
                left = {
                    kind: "bin",
                    op: t.value as "*" | "/",
                    left,
                    right: this.parseFactor()
                };
                continue;
            }
            // 隐式乘法：2x、3(x+1)、2sin(x)、x y
            if (
                t !== undefined &&
                (t.type === "NUM" ||
                    t.type === "IDENT" ||
                    t.type === "LPAREN")
            ) {
                left = {
                    kind: "bin",
                    op: "*",
                    left,
                    right: this.parseFactor()
                };
                continue;
            }
            break;
        }
        return left;
    }

    /** factor := ('-' factor) | power；一元负号优先级低于 ^ */
    private parseFactor(): Node {
        const t = this.peek();
        if (t?.type === "OP" && t.value === "-") {
            this.next();
            return { kind: "neg", arg: this.parseFactor() };
        }
        if (t?.type === "OP" && t.value === "+") {
            this.next();
            return this.parseFactor();
        }
        return this.parsePower();
    }

    /** power := primary ('^' factor)?  右结合，且指数可带一元负号 */
    private parsePower(): Node {
        const base = this.parsePrimary();
        const t = this.peek();
        if (t?.type === "OP" && t.value === "^") {
            this.next();
            return { kind: "bin", op: "^", left: base, right: this.parseFactor() };
        }
        return base;
    }

    /** primary := NUM | IDENT | IDENT '(' expr ')' | '(' expr ')' */
    private parsePrimary(): Node {
        const t = this.next();
        if (t === undefined) {
            throw new EquationError("表达式不完整（缺少操作数）");
        }

        if (t.type === "NUM") {
            const v = Number(t.value);
            if (!Number.isFinite(v)) {
                throw new EquationError(`无法解析的数字 "${t.value}"`);
            }
            return { kind: "num", value: v };
        }

        if (t.type === "LPAREN") {
            const inner = this.parseExpr();
            const close = this.next();
            if (close?.type !== "RPAREN") {
                throw new EquationError("缺少右括号 )");
            }
            return inner;
        }

        if (t.type === "IDENT") {
            const name = t.value.toLowerCase();

            // 函数调用：必须带括号
            if (FN_NAMES.has(name)) {
                const lp = this.next();
                if (lp?.type !== "LPAREN") {
                    throw new EquationError(
                        `函数 ${name} 后缺少括号，请写成 ${name}(...)`
                    );
                }
                const arg = this.parseExpr();
                const rp = this.next();
                if (rp?.type !== "RPAREN") {
                    throw new EquationError(`函数 ${name}(...) 缺少右括号`);
                }
                return { kind: "fn", name: name as FnName, arg };
            }

            // 常数
            if (name === "pi") {
                return { kind: "num", value: Math.PI };
            }
            if (name === "e") {
                return { kind: "num", value: Math.E };
            }

            // 变量（白名单：单字母，且不是常数 e）
            if (isAllowedVariable(name)) {
                return { kind: "var", name };
            }

            if (CONST_NAMES.has(name)) {
                throw new EquationError(`未知标识符 "${t.value}"`);
            }
            throw new EquationError(
                `未知标识符 "${t.value}"（仅支持单字母变量、pi、e 与白名单函数）`
            );
        }

        if (t.type === "RPAREN") {
            throw new EquationError("多余的右括号 )");
        }
        throw new EquationError(
            `意外的记号 "${t.value}"（位置 ${t.pos + 1}）`
        );
    }

    private peek(): Token | undefined {
        return this.tokens[this.idx];
    }

    private next(): Token | undefined {
        return this.tokens[this.idx++];
    }
}

/* ------------------------------------------------------------------ */
/* 求值 / 编译                                                          */
/* ------------------------------------------------------------------ */

/** 角度单位 → 弧度 */
function toRad(x: number, unit: AngleUnit): number {
    switch (unit) {
        case "DEG":
            return (x * Math.PI) / 180;
        case "GRA":
            return (x * Math.PI) / 200;
        default:
            return x;
    }
}

/** 弧度 → 当前角度单位（反三角函数输出） */
function fromRad(x: number, unit: AngleUnit): number {
    switch (unit) {
        case "DEG":
            return (x * 180) / Math.PI;
        case "GRA":
            return (x * 200) / Math.PI;
        default:
            return x;
    }
}

function applyFn(name: FnName, v: number, unit: AngleUnit): number {
    switch (name) {
        case "sin":
            return Math.sin(toRad(v, unit));
        case "cos":
            return Math.cos(toRad(v, unit));
        case "tan":
            return Math.tan(toRad(v, unit));
        case "asin":
            return fromRad(Math.asin(v), unit);
        case "acos":
            return fromRad(Math.acos(v), unit);
        case "atan":
            return fromRad(Math.atan(v), unit);
        case "log":
            return Math.log10(v);
        case "ln":
            return Math.log(v);
        case "sqrt":
            return Math.sqrt(v);
        case "abs":
            return Math.abs(v);
        case "exp":
            return Math.exp(v);
    }
}

function evalNode(node: Node, vars: Record<string, number>, unit: AngleUnit): number {
    switch (node.kind) {
        case "num":
            return node.value;
        case "var":
            if (!(node.name in vars)) {
                throw new EquationError(`变量 ${node.name} 未赋值`);
            }
            return vars[node.name];
        case "neg":
            return -evalNode(node.arg, vars, unit);
        case "fn":
            return applyFn(node.name, evalNode(node.arg, vars, unit), unit);
        case "bin": {
            const a = evalNode(node.left, vars, unit);
            const b = evalNode(node.right, vars, unit);
            switch (node.op) {
                case "+":
                    return a + b;
                case "-":
                    return a - b;
                case "*":
                    return a * b;
                case "/":
                    return a / b;
                case "^":
                    return Math.pow(a, b);
            }
        }
    }
}

/**
 * 编译方程文本为可反复调用的数值函数 f(x)。
 *
 * @param src       方程文本，如 "x^2 - 4 = 0" 或 "sin(x)"
 * @param varName   求解变量名（默认 x）
 * @param angleUnit 三角函数角度单位（默认 RAD）
 * @returns         f(x)，已自动移项为 f(x)=0 形式
 * @throws EquationError 语法错误 / 白名单外标识符
 */
export function compileEquation(
    src: string,
    varName: string = "x",
    angleUnit: AngleUnit = "RAD"
): (x: number) => number {
    const text = src.trim();
    if (text === "") {
        throw new EquationError("方程为空");
    }

    const varLower = varName.toLowerCase();
    if (!isAllowedVariable(varLower)) {
        throw new EquationError(`非法变量名 "${varName}"`);
    }

    const ast = new Parser(tokenize(text)).parseEquation();

    // 收集 AST 中出现的全部变量名，确保除求解变量外没有自由变量
    const used = collectVars(ast);
    let foreignVar: string | null = null;
    used.forEach(name => {
        if (foreignVar === null && name !== varLower) {
            foreignVar = name;
        }
    });
    if (foreignVar !== null) {
        throw new EquationError(
            `方程中包含求解变量 ${varLower} 以外的未知量 "${foreignVar}"`
        );
    }

    return (x: number) => evalNode(ast, { [varLower]: x }, angleUnit);
}

function collectVars(node: Node, acc: Set<string> = new Set()): Set<string> {
    switch (node.kind) {
        case "var":
            acc.add(node.name);
            break;
        case "neg":
            collectVars(node.arg, acc);
            break;
        case "fn":
            collectVars(node.arg, acc);
            break;
        case "bin":
            collectVars(node.left, acc);
            collectVars(node.right, acc);
            break;
        default:
            break;
    }
    return acc;
}
