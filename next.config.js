/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // swcMinify: true,   // 可删，新版本默认开启

  // ========== 关键：开启静态导出 ==========
  output: 'export',

  // ========== 子路径部署（匹配你的仓库名） ==========
  basePath: "/FX-991-CNX",
  assetPrefix: "/FX-991-CNX",

  // ========== 关闭图片优化 ==========
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
