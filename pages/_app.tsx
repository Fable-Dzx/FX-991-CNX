import type { AppProps } from "next/app";
import Head from "next/head";
import localFont from "next/font/local";
import { useEffect } from "react";

// CASIO fx-991CN X 液晶屏为点阵像素字符（5×7 dot-matrix），
// 用像素字体渲染屏幕输出，复刻真机 LCD 观感。
const lcdFont = localFont({
    src: "../fonts/dotgothic16-latin.woff2",
    display: "swap",
    weight: "400",
    variable: "--font-lcd"
});

function MyApp({ Component, pageProps }: AppProps) {
    // 生产环境注册 PWA service worker（离线可用）
    useEffect(() => {
        if (
            process.env.NODE_ENV === "production" &&
            "serviceWorker" in navigator
        ) {
            navigator.serviceWorker.register("/FX-991-CNX/sw.js").catch(() => {});
        }
    }, []);

    return (
        <div className={lcdFont.variable}>
            <Head>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
                />
            </Head>
            <Component {...pageProps} />
        </div>
    );
}

export default MyApp;
