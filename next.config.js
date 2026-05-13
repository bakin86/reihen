/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.reihen.mn" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Force HTTPS for 1 year (only active in production)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Prevent clickjacking — no iframe embedding
          { key: "X-Frame-Options", value: "DENY" },
          // Block MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Only send referrer for same-origin
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Opt out of Google FLoC / Topics
          { key: "Permissions-Policy", value: "interest-cohort=()" },
          // XSS filter (legacy browsers)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // Next.js needs inline scripts
              "style-src 'self' 'unsafe-inline'",                   // Tailwind
              "img-src 'self' data: blob: https:",                  // External images
              "font-src 'self'",
              "connect-src 'self' ws: wss: https://api.icafecloud.com https://merchant.qpay.mn https://merchant-sandbox.qpay.mn https://api.groq.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
