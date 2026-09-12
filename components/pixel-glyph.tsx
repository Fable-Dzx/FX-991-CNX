import { useEffect, useState } from "react";

/**
 * 将 MathML SVG 字形栅格化为低分辨率点阵位图，再以最近邻放大显示，
 * 复刻卡西欧真机 LCD 像素屏的输入行效果。
 *
 * 每个 SVG 只栅格化一次（模块级缓存），之后命中缓存零开销。
 */

const cache = new Map<string, string>();

/** SVG 显示基准高度（px） */
export const GLYPH_HEIGHT = 30;

/** 栅格密度：1 个网格像素 ≈ 显示像素 / PIXEL_RATIO，数值越小像素块越大 */
const PIXEL_RATIO = 2.4;

function parseViewBox(svg: string): [number, number, number, number] {
    const m = svg.match(/viewBox="([\d.\- ]+)"/);
    const n = m
        ? m[1].split(/[\s,]+/).map(Number)
        : [0, -750, 1000, 1000];
    return [n[0], n[1], n[2], n[3]];
}

async function rasterize(svg: string): Promise<string | null> {
    const img = new Image();
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    try {
        await img.decode();
    } catch {
        return null;
    }
    const [vx, vy, vw, vh] = parseViewBox(svg);
    const dispW = Math.max(6, Math.round((GLYPH_HEIGHT * vw) / Math.abs(vh)));
    const gridW = Math.max(6, Math.round(dispW / PIXEL_RATIO));
    const gridH = Math.max(6, Math.round(GLYPH_HEIGHT / PIXEL_RATIO));
    const cv = document.createElement("canvas");
    cv.width = gridW;
    cv.height = gridH;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, gridW, gridH);
    return cv.toDataURL("image/png");
}

export default function PixelGlyph({
    svg,
    alt = "",
    className,
    onClick,
}: {
    svg: string;
    alt?: string;
    className?: string;
    onClick?: () => void;
}) {
    const [data, setData] = useState<string>(() => cache.get(svg) ?? "");
    useEffect(() => {
        if (cache.has(svg)) {
            setData(cache.get(svg)!);
            return;
        }
        let alive = true;
        rasterize(svg).then((url) => {
            if (url) {
                cache.set(svg, url);
                if (alive) setData(url);
            }
        });
        return () => {
            alive = false;
        };
    }, [svg]);

    if (!data) {
        // 栅格化尚未完成时占位，避免布局跳动
        return (
            <span
                className={className}
                style={{
                    display: "inline-block",
                    width: GLYPH_HEIGHT * 0.5,
                    height: GLYPH_HEIGHT,
                }}
            />
        );
    }

    const [vx, vy, vw, vh] = parseViewBox(svg);
    const w = Math.max(6, Math.round((GLYPH_HEIGHT * vw) / Math.abs(vh)));
    return (
        <img
            className={className}
            alt={alt}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onClick={onClick}
            src={data}
            style={{
                width: w,
                height: GLYPH_HEIGHT,
                imageRendering: "pixelated",
                verticalAlign: "bottom",
            }}
        />
    );
}
