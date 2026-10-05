import type { NextConfig } from "next";

/**
 * next/image refuses any host not listed here, so a photograph served from a
 * new bucket silently fails to render until its hostname is added. R2's is read
 * from the environment at build time, which keeps the bucket's address out of
 * the repository and lets a custom domain replace the default without a code
 * change.
 */
const imageHosts = [
  "images.unsplash.com", // seed photographs
  "ocpufyaehwungqqllrqx.supabase.co", // objects not yet moved to R2
  process.env.NEXT_PUBLIC_MEDIA_HOSTNAME, // R2, via r2.dev or a custom domain
].filter((host): host is string => Boolean(host));

const nextConfig: NextConfig = {
  images: {
    remotePatterns: imageHosts.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
};

export default nextConfig;
