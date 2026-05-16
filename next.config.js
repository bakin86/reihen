/** @type {import('next').NextConfig} */
const nextConfig = {
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.dev https://clerk.com https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: https://img.clerk.com",
              // next/font/google serves files from /_next/static (self) but needs
              // fonts.gstatic.com for the actual font binary download at build+runtime
              "font-src 'self' https://fonts.gstatic.com https://*.clerk.accounts.dev https://*.clerk.dev",
              // 'self' covers same-origin fetches; explicit vercel URLs cover
              // preview deployments where 'self' origin differs from production URL
              "connect-src 'self' https://reihen.vercel.app https://*.vercel.app ws: wss: https://api.icafecloud.com https://merchant.qpay.mn https://merchant-sandbox.qpay.mn https://api.groq.com https://*.clerk.accounts.dev https://*.clerk.dev https://api.clerk.com https://clerk-telemetry.com https://*.clerk-telemetry.com https://challenges.cloudflare.com",
              "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://challenges.cloudflare.com",
              "worker-src 'self' blob:",
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
