import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone only for our own pages (the voice demo); camera and location stay off.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Always put title/description in <head> (Next streams them into <body> for non-bot browsers,
  // which Lighthouse and some link-preview fetchers miss).
  htmlLimitedBots: /.*/,
  // PGlite ships WASM + data files; load it from node_modules instead of bundling it.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Ops Suite CSV imports send the file body to a server action (files are capped at 1 MB in the app).
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      // A proxy in front of the browser (e.g. a system proxy adding `x-forwarded-host`) makes Next reject Server
      // Actions as cross-site. Trust the local dev origins in development; in production list extra origins
      // (comma-separated host[:port]) in SERVER_ACTIONS_ALLOWED_ORIGINS only if a proxy needs it.
      allowedOrigins: [
        ...(process.env.NODE_ENV === "development" ? ["localhost:3000", "127.0.0.1:3000"] : []),
        ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
      ],
    },
  },
  images: { formats: ["image/avif", "image/webp"] },
  // The About section lives on the home page; old /about links land there.
  async redirects() {
    return [{ source: "/about", destination: "/#about", permanent: true }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
