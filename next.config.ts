import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Addresses from before the directory became the home page of its own domain.
  redirects: async () => [
    { source: "/direktori", destination: "/", permanent: true },
    { source: "/direktori/:id", destination: "/bisnis/:id", permanent: true },
  ],
};

export default nextConfig;
