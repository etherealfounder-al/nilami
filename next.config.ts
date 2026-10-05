import type { NextConfig } from "next";

/**
 * next/image refuses any host not listed here, so a photograph served from a
 * new bucket silently fails to render until its hostname is added.
 *
 * The R2 domain is written here rather than left to the environment. It is a
 * public hostname, not a secret, and a missing variable would not fail the
 * build — it would ship a site whose every photograph is a broken image.
 */
const imageHosts = [
  "images.unsplash.com", // seed photographs
  "ocpufyaehwungqqllrqx.supabase.co", // objects not yet moved to R2
  "cdn.ujjwolkayastha.com.np", // R2, behind its custom domain
  process.env.NEXT_PUBLIC_MEDIA_HOSTNAME, // an override, for another bucket
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
