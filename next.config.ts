import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Supabase Storage public buckets
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Turbopack alias: react-leaflet-cluster auto-imports its own CSS from within
  // its JS bundle. Turbopack can't handle CSS imported that way (module factory
  // error). We already import the CSS globally in globals.css, so redirect the
  // package's own imports to an empty stub to suppress the duplicate.
  turbopack: {
    resolveAlias: {
      "react-leaflet-cluster/lib/assets/MarkerCluster.css":
        path.resolve("./src/styles/empty.css"),
      "react-leaflet-cluster/lib/assets/MarkerCluster.Default.css":
        path.resolve("./src/styles/empty.css"),
    },
  },
};

export default nextConfig;
