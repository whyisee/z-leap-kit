import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  adapter: node({
    mode: "standalone",
  }),
  devToolbar: {
    enabled: false,
  },
  output: "server",
  security: {
    allowedDomains: [
      {
        hostname: "whyisee.xyz",
        protocol: "https",
      },
      {
        hostname: "www.whyisee.xyz",
        protocol: "https",
      },
    ],
  },
  site: process.env.SITE_URL || "https://whyisee.xyz",
});
