import React from "react";
import { observer } from "mobx-react-lite";
import fx from "../observables/fx991-state";
import cs from "../observables/calculator-state";
import stringsRes from "../observables/strings-res";
import fxStyles from "../styles/fx991.module.scss";

/** SOLVE 面板可选变量（与 equation.ts 的单字母变量白名单一致） */
const SOLVE_VARS = ["x", "y", "z", "t", "a", "b", "c"];

/**
 * SOLVE（一键解方程）输入面板。
 * EQN 模式选择 5 后替换 fx 文本行区域渲染。
 */
const SolvePanel: React.FC = observer(() => {
    const S = stringsRes.strings.SOLVE_UI;
    const result = fx.solveResult;

    const onSolve = () => {
        fx.solveRun(cs.drgMode);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            onSolve();
        }
    };

    return (
        <div className={fxStyles.solvePanel}>
            <div className={fxStyles.solveTitle}>{S.TITLE}</div>

            <label className={fxStyles.solveRow}>
                <span className={fxStyles.solveLabel}>{S.EQN_LABEL}</span>
                <input
                    className={fxStyles.solveInput}
                    value={fx.solveEqn}
                    placeholder={S.EQN_PLACEHOLDER}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={e => fx.solveSetEqn(e.target.value)}
                    onKeyDown={onKeyDown}
                />
            </label>

            <div className={fxStyles.solveRow}>
                <span className={fxStyles.solveLabel}>{S.VAR_LABEL}</span>
                <select
                    className={fxStyles.solveSelect}
                    value={fx.solveVar}
                    onChange={e => fx.solveSetVar(e.target.value)}>
                    {SOLVE_VARS.map(v => (
                        <option key={v} value={v}>
                            {v}
                        </option>
                    ))}
                </select>
                <span className={fxStyles.solveLabel}>{S.GUESS_LABEL}</span>
                <input
                    className={fxStyles.solveInputShort}
                    value={fx.solveGuess}
                    inputMode="decimal"
                    spellCheck={false}
                    autoComplete="off"
                    onChange={e => fx.solveSetGuess(e.target.value)}
                    onKeyDown={onKeyDown}
                />
            </div>

            <div className={fxStyles.solveBtnRow}>
                <button
                    type="button"
                    className={fxStyles.solveBtn}
                    onClick={onSolve}>
                    {S.SOLVE_BTN}
                </button>
                <button
                    type="button"
                    className={fxStyles.solveBtnSecondary}
                    onClick={() => fx.solveClear()}>
                    {S.CLEAR_BTN}
                </button>
            </div>

            {result !== null && (
                <div className={fxStyles.solveResult}>
                    {!result.ok && (
                        <div className={fxStyles.solveError}>{result.error}</div>
                    )}
                    {result.ok && result.converged && (
                        <>
                            <div className={fxStyles.solveRoot}>
                                {fx.solveVar.toUpperCase()}={result.rootText}
                            </div>
                            <div className={fxStyles.solveMeta}>
                                {S.CONVERGED} · {S.ITERATIONS}:{" "}
                                {result.iterations} · {S.FINAL_VALUE}:{" "}
                                {result.finalValue.toExponential(3)}
                            </div>
                        </>
                    )}
                    {result.ok && !result.converged && (
                        <>
                            <div className={fxStyles.solveError}>
                                {S.FAIL_MSG}
                            </div>
                            <div className={fxStyles.solveMeta}>
                                {S.NOT_CONVERGED}
                                {result.status in S.STATUS &&
                                    result.status !== "MAX_ITER_REACHED" &&
                                    ` · ${
                                        S.STATUS[
                                            result.status as keyof typeof S.STATUS
                                        ]
                                    }`}
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className={fxStyles.solveNote}>{S.SINGLE_ROOT_NOTE}</div>
        </div>
    );
});

export default SolvePanel;
