import type { NextConfig } from "next";

// Intentionally minimal. Add configuration only when a plan needs it — no
// speculative experimental flags.
const nextConfig: NextConfig = {
  experimental: {
    /**
     * Photo uploads travel through a server action, and Next caps a server
     * action's body at **1 MB** by default — which is stricter than the 4.5 MB
     * Vercel serverless limit the upload design was built around.
     *
     * Found by measurement, not by reading: a 4000x3000 test image downscaled to
     * 1600px came out at 1137 KB, the action request was rejected before it ran,
     * and the form simply sat there with no error to show — the failure is
     * silent from the user's side.
     *
     * 3 MB leaves headroom over the 2 MB validation limit in
     * lib/validation/attachment.ts (which is the real limit, and the one that
     * reports a readable message) while staying under Vercel's platform cap.
     */
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
