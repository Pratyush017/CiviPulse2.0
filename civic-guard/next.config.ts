import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["onnxruntime-node", "sharp"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cpcmkcjddqpkhjhvugto.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
