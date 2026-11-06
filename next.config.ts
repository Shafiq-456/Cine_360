import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  /* Keep the dev-tools badge out of the auditorium HUD (bottom-left overlaps
     the Seat Experience controls on small screens). */
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
