import type { NextConfig } from "next";
import path from "path";

// The browser calls /api/* on this origin; locally the dev server proxies it to the backend (gs-hrms-backend), so the
// session cookie and the backend's CSRF origin check see one origin. In Azure, Front Door routes /api/* instead.
// The API flow is on for `next dev` and wherever HRMS_API_URL is set. Any other build (a hosted preview with no
// backend yet) runs on the built-in demo data, with sign-in kept in the browser.
const API_ON = process.env.NODE_ENV === "development" || !!process.env.HRMS_API_URL;
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
