import type { NextConfig } from "next";
import path from "path";

// The browser calls /api/* on this origin; locally the dev server proxies it to the backend (gs-hrms-backend), so the
// session cookie and the backend's CSRF origin check see one origin. In Azure, Front Door routes /api/* instead.
const API_URL = process.env.HRMS_API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
