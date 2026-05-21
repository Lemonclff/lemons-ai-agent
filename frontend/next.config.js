/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // 允許 Langfuse 的 iframe 嵌入
  async headers() {
    return [
      {
        source: "/observability/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-src 'self' https://cloud.langfuse.com https://*.langfuse.com" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
