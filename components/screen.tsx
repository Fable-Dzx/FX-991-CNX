import React from "react";
import { observer } from "mobx-react-lite";
import cs from "../observables/calculator-state";
import styles from "../styles/screen.module.scss";
import stringsRes from "../observables/strings-res";
import * as L from "../logics/screen";
import fx, { MODE_MENU_ITEMS, FX_MODES } from "../observables/fx991-state";
import * as FX from "../logics/fx991";
import fxStyles from "../styles/fx991.module.scss";

/** 结果文本：ENG 工程计数激活时显示 ×10^3n 形式 */
const displayResultText = (cs: typeof import("../observables/calculator-state").default) =>
    cs.engActive && cs.dispResult.type === "DEC"
        ? cs.engResultText()
        : cs.dispResult.toString();

/** 点击结果复制到剪贴板，并短暂显示 COPIED 提示 */
const copyResult = (
    cs: typeof import("../observables/calculator-state").default,
    setCopied: (b: boolean) => void
) => {
    const text = displayResultText(cs);
    if (navigator.clipboard?.writeText) {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
            })
            .catch(() => {});
    }
};

export default class Screen extends React.Component {
    constructor(props: {}) {
        super(props);
    }

    ThisComponent = observer(() => {
        const [copied, setCopied] = React.useState(false);
        return (
        <div className={styles.divScreenWrapper}>
            {copied && <div className={styles.copiedTip}>COPIED</div>}
            {fx.showModeMenu && (
                <div className={fxStyles.divModeMenuWrapper}>
                    <div className={fxStyles.modeMenuTitle}>MODE MENU</div>
                    <div className={fxStyles.modeMenuGrid}>
                        {MODE_MENU_ITEMS.map(item => (
                            <div
                                key={item.key}
                                className={
                                    fx.mode ===
                                    FX_MODES[Number(item.key) - 1]
                                        ? fxStyles.modeMenuItemActive
                                        : undefined
                                }
                                onClick={() => FX.onModeMenuSelect(item.key)}>
                                <span className={fxStyles.modeMenuKey}>
                                    {item.key}
                                </span>
                                {item.label}
                            </div>
                        ))}
                        <div
                            className={
                                cs.displayMode === "DRG"
                                    ? fxStyles.modeMenuItemActive
                                    : undefined
                            }
                            onClick={() => FX.onModeMenuSelect("6")}>
                            <span className={fxStyles.modeMenuKey}>6</span>
                            DRG 角度单位
                        </div>
                    </div>
                </div>
            )}

            {cs.displayMode === "DRG" && (
                <div className={styles.divDrgWrapper}>
                    <div onClick={() => L.onDrgClick("D")}>
                        {stringsRes.strings.DEG}
                    </div>
                    <div onClick={() => L.onDrgClick("R")}>
                        {stringsRes.strings.RAD}
                    </div>
                    <div onClick={() => L.onDrgClick("G")}>
                        {stringsRes.strings.GRA}
                    </div>
                </div>
            )}

            {cs.displayMode === "CLEAR" && (
                <div className={styles.divClearWrapper}>
                    <div onClick={() => L.onClearClick(0)}>
                        {stringsRes.strings.CLEAR[0]}
                    </div>
                    <div onClick={() => L.onClearClick(1)}>
                        {stringsRes.strings.CLEAR[1]}
                    </div>
                    <div onClick={() => L.onClearClick(2)}>
                        {stringsRes.strings.CLEAR[2]}
                    </div>
                </div>
            )}

            {cs.displayMode === "LANG" && (
                <div className={styles.divLangWrapper}>
                    <div onClick={() => L.onLangClick("ZH_CN")}>中文</div>
                    <div onClick={() => L.onLangClick("EN")}>English</div>
                </div>
            )}

            {cs.displayMode === "ABOUT" && (
                <div className={styles.divAboutWrapper}>
                    <title>{"FX-991-CNX — Web Scientific Calculator"}</title>
                    <title>{"Adapted from EC-82MS · Made with LOVE❤️ by Ernest Cui"}</title>
                    <title>{"August, 2022"}</title>
                    <div>
                        Original project:
                        <a href="https://github.com/ErnestThePoet/ec-82-ms">
                            Github
                        </a>
                        <a href="https://gitee.com/ecui/ec-82-ms">Gitee</a>
                    </div>
                </div>
            )}

            {!fx.showModeMenu &&
                FX.isFxModeActive() &&
                (cs.displayMode === "NORMAL_EDIT" ||
                    cs.displayMode === "NORMAL_SHOW" ||
                    cs.displayMode === "ERROR") && (
                    <div className={fxStyles.divFxWrapper}>
                        <div role="fxmode">{FX.fxModeLabel()}</div>
                        <div role="fxlines">
                            {FX.fxScreenLines().map((line, i) => (
                                <div key={i} className={fxStyles.fxLine}>
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            {!fx.showModeMenu &&
                !FX.isFxModeActive() &&
                (cs.displayMode === "NORMAL_EDIT" ||
                    cs.displayMode === "NORMAL_SHOW" ||
                    cs.displayMode === "ERROR") && (
                    <div className={styles.divNormalWrapper}>
                        <div role="entries">
                            {cs.entries.map((x, i) => (
                                <img
                                    key={i}
                                    className={
                                        cs.displayMode === "NORMAL_EDIT" &&
                                        i === cs.cursorIndex
                                            ? cs.isInsert
                                                ? styles.imgInsert
                                                : styles.imgOverwrite
                                            : styles.imgNormal
                                    }
                                    alt={x.id}
                                    draggable={false}
                                    onContextMenu={(e) =>
                                        e.preventDefault()
                                    }
                                    onClick={() =>
                                        L.onKeyEntryImgClick(i)
                                    }
                                    src={`data:image/svg+xml;utf8,${encodeURIComponent(
                                        x.svg
                                    )}`}
                                />
                            ))}
                            <img
                                className={
                                    cs.displayMode === "NORMAL_EDIT" &&
                                    cs.cursorIndex === cs.entries.length
                                        ? cs.isInsert
                                            ? styles.imgInsert
                                            : styles.imgOverwrite
                                        : styles.imgNormal
                                }
                                alt="CURSOR"
                                draggable={false}
                                onContextMenu={(e) => e.preventDefault()}
                                style={{ height: 20, width: 15 }}
                                /* Without explicit size,
                            this cursor will have large size
                            on IOS browsers, making entries div
                            reach its max-height. */
                                onClick={() =>
                                    L.onKeyEntryImgClick(cs.entries.length)
                                }
                                src={`data:image/svg+xml;utf8,${encodeURIComponent(
                                    '<svg xmlns="http://www.w3.org/2000/svg" width="2.262ex" height="0" viewBox="0 0 1000 0" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" style=""><defs></defs><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="matrix(1 0 0 -1 0 0)"><g data-mml-node="math"><g data-mml-node="mstyle"><g data-mml-node="mspace"></g></g></g></g></svg>'
                                )}`}
                            />
                        </div>

                        {cs.displayMode === "ERROR" && (
                            <div role="error">{cs.errorMessage}</div>
                        )}

                        {cs.displayMode !== "ERROR" && (
                            <div
                                role="result"
                                title="点击复制结果"
                                onClick={() => copyResult(cs, setCopied)}>
                                {displayResultText(cs)}
                            </div>
                        )}

                        <div role="mode">
                            <span>
                                {cs.funcMode === "NONE" ? "" : cs.funcMode}
                            </span>

                            <span>{cs.hypMode ? "HYP" : ""}</span>

                            <span>{cs.drgMode}</span>
                        </div>
                    </div>
                )}
        </div>
        );
    });

    render = () => <this.ThisComponent />;
}
