import type { NextConfig } from "next";
import path from "path";

// The browser calls /api/* on this origin; locally the dev server proxies it to the backend (gs-hrms-backend), so the
// session cookie and the backend's CSRF origin check see one origin.
// For now the API flow is local only (`next dev`). Every build (`next build`, the hosted site) runs on the built-in
// demo data with sign-in kept in the browser, and never calls a backend, whatever HRMS_API_URL says.
const API_ON = process.env.NODE_ENV === "development";
// Where the local dev server finds the backend.
const API_URL = process.env.HRMS_API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  env: {
    NEXT_PUBLIC_HRMS_API: API_ON ? "on" : "off",
  },
  async rewrites() {
    return API_ON ? [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }] : [];
  },
};

export default nextConfig;
